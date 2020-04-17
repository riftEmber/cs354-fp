package controllers

import akka.actor.ActorSystem
import akka.event.{Logging, LoggingAdapter}
import akka.stream.Materializer
import akka.stream.scaladsl.{BroadcastHub, Flow, Keep, MergeHub, Source}
import assets.BackupWords
import java.net.URI
import javax.inject._
import play.api.Logger
import play.api.libs.json._
import play.api.libs.ws.{WSClient, WSRequest}
import play.api.mvc._
import scala.collection.mutable.ListBuffer
import scala.concurrent.duration._
import scala.concurrent.{Await, ExecutionContext, Future}
import scala.util.Random


@Singleton
class GameController @Inject()(wsClient: WSClient, controllerComponents: ControllerComponents, random: Random)
                              (implicit actorSystem: ActorSystem,
                               mat: Materializer,
                               executionContext: ExecutionContext)
        extends AbstractController(controllerComponents) with SameOriginCheck {

    val logger: Logger = Logger(getClass)
    private implicit val logging: LoggingAdapter = Logging(actorSystem.eventStream, logger.underlyingLogger.getName)
    private val WordnikKey = "WORDNIK_API_KEY"
    private val game = models.Game()

    def index: Action[AnyContent] = Action { implicit request: RequestHeader =>
        val webSocketUrl = routes.GameController.ws().webSocketURL()
        logger.debug(s"WebSocket URL: $webSocketUrl")
        Ok(views.html.index(webSocketUrl))
    }

    // many clients -> merge hub -> broadcast hub -> many clients
    private val (chatSink, chatSource) = {
        // Don't log MergeHub$ProducerFailed as error if the client disconnects.
        // recoverWithRetries -1 is essentially "recoverWith"
        val source = MergeHub.source[JsValue]
                .log("source")
                // Let's also do some input sanitization to avoid XSS attacks
                //          .map(inputSanitizer.sanitize)
                .recoverWithRetries(-1, { case _: Exception => Source.empty })

        val sink = BroadcastHub.sink[JsValue]
        source.map(message => handleMessage(message)).toMat(sink)(Keep.both).run()
    }

    private def handleMessage(message: JsValue): JsValue = {
        Json.fromJson[GameUpdate](message) match {
            case JsSuccess(update: GameUpdate, _: JsPath) =>
                logger.info(s"received $update")
                update.updateType match {
                    case "hello" =>
                        if (game.isRunning) {
                            Json.toJson(GameUpdate("gameFull", update.userID))
                        } else {
                            game.addPlayer(update.userID)
                            var boardData: Option[JsObject] = None
                            if (game.isFull) {
                                game.start(genWordList(scala.math.pow(game.BoardDim, 2).toInt))
                                boardData = Some(new JsObject(game.board.zipWithIndex
                                        .map({ case (square, index) => (index.toString, Json.toJson(square)) }).toMap))
                            }
                            Json.toJson(GameUpdate("hello", update.userID,
                                Some(Json.obj("data" -> boardData, "players" -> Json.toJson(game.players), "turn" -> game.turn))))
                        }
                    case "guess" =>
                        val data = update.data.get.as[JsObject]
                        Json.toJson(GameUpdate("guessResult", update.userID,
                            Some(Json.toJson(game.makeGuess(data.value("index").as[Int], update.userID)))))
                    case "clue" =>
                        val data = update.data.get.as[JsObject]
                        val clueValid = game.attemptClue(data.value("clue").as[String], data.value("numGuesses").as[String], update.userID)
                        Json.toJson(GameUpdate("clue", update.userID, Some(Json.obj("valid" -> clueValid, "clue" -> data.value("clue"),
                            "numGuesses" -> game.guessesRemaining, "turn" -> game.turn))))
                    case "bye" =>
                        game.removePlayer(update.userID)
                        var stopped = false;
                        if (game.isRunning) {
                            logger.info(s"player ${update.userID} disconnected before game end!")
                            game.isRunning = false;
                            stopped = true;
                            //                            Json.toJson(GameUpdate("gameEnd", update.userID,
                            //                                Some(Json.obj("clean" -> false, "winner" -> Json.toJson(None: Option[Color])))))
                        }
                        Json.toJson(GameUpdate("bye", update.userID, Some(Json.obj("stopGame" -> stopped, "players" -> Json.toJson(game.players)))))
                    case "ping" => Json.toJson(GameUpdate("pong", update.userID))
                    case _ =>
                        val msg: String = s"unrecognized update type '${update.updateType}'"
                        logger.error(msg)
                        Json.obj("error" -> msg)
                }
            case e@JsError(_) =>
                logger.error(s"error parsing game update: ${JsError.toJson(e)}")
                JsError.toJson(e)
        }
    }

    private def genWordList(length: Int): ListBuffer[String] = {
        var words = ListBuffer[String]()
        var i = 0
        sys.env.get(WordnikKey) match {
            case Some(key) =>
                while (words.size < length && i < 5) {
                    val request: WSRequest = wsClient.url(s"https://api.wordnik.com/v4/words.json/randomWords?hasDictionaryDef=true&includePartOfSpeech=noun&minCorpusCount=25000&minDictionaryCount=5&maxDictionaryCount=-1&minLength=4&maxLength=12&limit=25&api_key=$key")
                    val result = request.get().map { response =>
                        response.json.as[ListBuffer[JsValue]].foreach { x =>
                            val word = (x \ "word").as[String]
                            if (word.charAt(0) == word.charAt(0).toLower) {
                                words += word
                            }
                        }
                    }
                    Await.ready(result, 5.seconds)
                    i += 1
                }
                if (words.size >= length) {
                    words
                } else {
                    logger.error("giving up on wordlist generation after 5 attempts")
                    BackupWords.wordList
                }
            case None =>
                BackupWords.wordList
        }
    }

    private val userFlow: Flow[JsValue, JsValue, _] = {
        Flow.fromSinkAndSource(chatSink, chatSource)
    }

    def ws: WebSocket = {
        WebSocket.acceptOrResult[JsValue, JsValue] {
            case rh if sameOriginCheck(rh) =>
                Future.successful(userFlow).map { flow =>
                    Right(flow)
                }.recover {
                    case e: Exception =>
                        val msg = "Cannot create websocket"
                        logger.error(msg, e)
                        val result = InternalServerError(msg)
                        Left(result)
                }

            case rejected =>
                logger.error(s"Request ${rejected} failed same origin check")
                Future.successful {
                    Left(Forbidden("forbidden"))
                }
        }
    }
}

trait SameOriginCheck {
    def logger: Logger

    /**
     * Checks that the WebSocket comes from the same origin.  This is necessary to protect
     * against Cross-Site WebSocket Hijacking as WebSocket does not implement Same Origin Policy.
     *
     * See https://tools.ietf.org/html/rfc6455#section-1.3 and
     * http://blog.dewhurstsecurity.com/2013/08/30/security-testing-html5-websockets.html
     */
    def sameOriginCheck(rh: RequestHeader): Boolean = {
        // The Origin header is the domain the request originates from.
        // https://tools.ietf.org/html/rfc6454#section-7
        logger.debug("Checking the ORIGIN ")

        rh.headers.get("Origin") match {
            case Some(originValue) if originMatches(originValue) =>
                logger.debug(s"originCheck: originValue = $originValue")
                true

            case Some(badOrigin) =>
                logger.error(s"originCheck: rejecting request because Origin header value ${badOrigin} is not in the same origin")
                false

            case None =>
                logger.error("originCheck: rejecting request because no Origin header found")
                false
        }
    }

    /**
     * Returns true if the value of the Origin header contains an acceptable value.
     */
    private def originMatches(origin: String): Boolean = {
        try {
            val url = new URI(origin)
            val validHosts = List("localhost", "infinite-mountain-96832.herokuapp.com")
            //            val validPorts = List(9000)
            //            logger.info(s"origin is ${url.getHost}:${url.getPort}")
            validHosts.contains(url.getHost) // && validPorts.contains(url.getPort)
        } catch {
            case e: Exception => false
        }
    }
}

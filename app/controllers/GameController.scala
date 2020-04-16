package controllers

import akka.actor.ActorSystem
import akka.event.{Logging, LoggingAdapter}
import akka.stream.Materializer
import akka.stream.scaladsl.{BroadcastHub, Flow, Keep, MergeHub, Source}
import java.net.URI
import javax.inject._
import models.Game
import play.api.Logger
import play.api.libs.json._
import play.api.mvc._
import scala.concurrent.{ExecutionContext, Future}
import scala.math._
import scala.util.Random


@Singleton
class GameController @Inject()(controllerComponents: ControllerComponents, random: Random)
                              (implicit actorSystem: ActorSystem,
                               mat: Materializer,
                               executionContext: ExecutionContext)
        extends AbstractController(controllerComponents) with SameOriginCheck {

    val logger: Logger = Logger(getClass)
    private implicit val logging: LoggingAdapter = Logging(actorSystem.eventStream, logger.underlyingLogger.getName)
    private val game = Game()

    def index: Action[AnyContent] = Action { implicit request: RequestHeader =>
        val webSocketUrl = routes.GameController.ws().webSocketURL()
        logger.info(s"WebSocket URL: $webSocketUrl")
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
                        val userID = genUserID
                        game.players.append(userID)
                        var gameData: Option[JsObject] = None
                        if (game.players.size == game.RequiredPlayers) {
                            game.start()
                            gameData = Some(new JsObject(game.board.zipWithIndex
                                    .map({ case (square, index) => (index.toString, Json.toJson(square)) }).toMap))
                        }
                        Json.toJson(GameUpdate("hello", userID, gameData))
                    case "ping" => Json.toJson(GameUpdate("pong", update.userID))
                    case "guess" =>
                        val data = update.data.get
                        game.guess(data.value("index").as[Int])
                        Json.toJson(GameUpdate("pong", update.userID))
                    case "bye" =>
                        logger.error(s"player ${update.userID} disconnected before game end! entering inconsistent state")
                        new JsObject(Map[String, JsValue]())
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

    private def genUserID: Int = max(1, abs(random.nextInt()))

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
//            logger.info(s"origin is ${url.getHost}:${url.getPort}")
            validHosts.contains(url.getHost)
        } catch {
            case e: Exception => false
        }
    }
}

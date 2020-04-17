package models

import models.Color.Color
import models.Role.Role
import play.api.Logger
import play.api.libs.json._
import scala.collection.mutable.ListBuffer
import scala.util.Random

class Game {
    val BoardDim = 5
    val RequiredPlayers = 4
    var board = new Array[Square](BoardDim * BoardDim)
    var players: ListBuffer[Player] = ListBuffer[Player]()
    var isRunning = false
    var turn: Option[Player] = None

    val logger: Logger = Logger(getClass)

    def addPlayer(playerID: Int): Unit = {
        val reds = players.count({ case Player(_, color, _) => color == Color.RED })
        val blues = players.count({ case Player(_, color, _) => color == Color.BLUE })
        val color = if (reds < blues) Color.RED else Color.BLUE;
        players.append(Player(playerID, color, None))
    }

    def removePlayer(playerID: Int): Unit = {
        val element = players.find(p => p.userID == playerID)
        if (element.isDefined) {
            players.remove(players.indexOf(element.get))
        }
    }

    def isFull: Boolean = players.length == RequiredPlayers

    def start(): Unit = {
        logger.info("starting game")
        board = Random.shuffle(Array[Square](
            Square(Color.BLUE), Square(Color.BLUE), Square(Color.BLUE), Square(Color.BLUE), Square(Color.BLUE), Square(Color.BLUE), Square(Color.BLUE), Square(Color.BLUE), Square(Color.BLUE),
            Square(Color.RED), Square(Color.RED), Square(Color.RED), Square(Color.RED), Square(Color.RED), Square(Color.RED), Square(Color.RED), Square(Color.RED),
            Square(Color.BLACK),
            Square(Color.GREY), Square(Color.GREY), Square(Color.GREY), Square(Color.GREY), Square(Color.GREY), Square(Color.GREY), Square(Color.GREY)
        ).toList).toArray
        isRunning = true;
        val blues = players.filter(p => p.color == Color.BLUE)
        blues.head.role = Some(Role.CLUE_GIVER)
        blues.last.role = Some(Role.GUESSER)
        val reds = players.filter(p => p.color == Color.RED)
        reds.head.role = Some(Role.CLUE_GIVER)
        reds.last.role = Some(Role.GUESSER)
        players = ListBuffer[Player](blues.head, blues.last, reds.head, reds.last)
        turn = Some(blues.head)
    }

    def makeGuess(index: Int, playerID: Int): GuessResult = {
        val player = players.find(p => p.userID == playerID).get
        if (!isRunning || turn.get != player || player.role.get != Role.GUESSER) {
            GuessResult(index, valid = false, correct = false, None)
        } else {
            logger.info(s"guess made at $index")
            revealSquare(index) match {
                case Some(correctColor: Color) if correctColor == player.color => GuessResult(index, valid = true, correct = true, Some(correctColor))
//            case Some(black: Color) if black == Color.BLACK => GuessResult(valid = true, correct = false, Some(black))
                case Some(otherColor: Color) => GuessResult(index, valid = true, correct = false, Some(otherColor))
                case None => GuessResult(index, valid = false, correct = false, None)
            }
        }
    }

    private def revealSquare(index: Int): Option[Color] = {
        logger.info(s"guess made at $index")
        if (board(index).revealed) {
            None
        } else {
            board(index).revealed = true;
            Some[Color](board(index).color)
        }
    }

    def makeClue(): Unit = {
        turn = Some(players.find(p => p.color == turn.get.color && p.role.get == Role.GUESSER).get)
    }

}

object Game {
    def apply(): Game = {
        new Game
    }
}

case class GuessResult(index: Int, valid: Boolean, correct: Boolean, color: Option[Color])

object GuessResult {

    implicit val guessResultWrites: Writes[GuessResult] = Json.writes[GuessResult]
}

case class Square(word: String, color: Color, var revealed: Boolean = false)

object Square {
    def apply(color: Color): Square = {
        new Square("asdf", color)
    }

    implicit val squareWrites: Writes[Square] = Json.writes[Square]
}

case class Player(userID: Int, color: Color, var role: Option[Role])

object Player {
    implicit val playerWrites: Writes[Player] = Json.writes[Player]
}

object Color extends Enumeration {
    type Color = Value
    val RED, BLUE, GREY, BLACK = Value;

    implicit val format: Format[models.Color.Value] = Json.formatEnum(this)
}

object Role extends Enumeration {
    type Role = Value
    val GUESSER, CLUE_GIVER = Value;

    implicit val format: Format[models.Role.Value] = Json.formatEnum(this)
}
package models

import models.Color.Color
import models.Role.Role
import play.api.Logger
import play.api.libs.json._
import scala.collection.mutable.ListBuffer
import scala.util.Random

class Game {
    val BoardDim = 5
    val RequiredPlayers = 1
    var board = new Array[Square](BoardDim * BoardDim)
    private val players: ListBuffer[Player] = ListBuffer[Player]()
    var isRunning = false

    val logger: Logger = Logger(getClass)

    def addPlayer(playerID: Int): Unit = {
        val reds = players.count({ case Player(_, color, _) => color == Color.RED })
        val blues = players.count({ case Player(_, color, _) => color == Color.BLUE })
        val color = if (reds < blues) Color.RED else Color.BLUE;
        players.append(Player(playerID, color, None))
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
    }

    def guess(index: Int, playerID: Int): GuessResult = {
        val player = players.find(p => p.userID == playerID).get
        logger.info(s"guess made at $index")
        reveal(index) match {
            case Some(correctColor: Color) if correctColor == player.color => GuessResult(index, valid = true, correct = true, Some(correctColor))
//            case Some(black: Color) if black == Color.BLACK => GuessResult(valid = true, correct = false, Some(black))
            case Some(otherColor: Color) => GuessResult(index, valid = true, correct = false, Some(otherColor))
            case None => GuessResult(index, valid = false, correct = false, None)
        }
    }

    def reveal(index: Int): Option[Color] = {
        logger.info(s"guess made at $index")
        if (board(index).revealed) {
            None
        } else {
            board(index).revealed = true;
            Some[Color](board(index).color)
        }
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

case class Player(userID: Int, color: Color, role: Option[Role])

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
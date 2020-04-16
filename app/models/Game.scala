package models

import models.Color.Color
import play.api.Logger
import play.api.libs.json._
import scala.collection.mutable.ListBuffer
import scala.util.Random

class Game {
    val BoardDim = 5
    val RequiredPlayers = 1
    var board = new Array[Square](BoardDim * BoardDim)
    var players: ListBuffer[Int] = ListBuffer[Int]()

    val logger: Logger = Logger(getClass)

    def start(): Unit = {
        for (x <- board.indices) {
            board(x) = Square()
        }
        board = Random.shuffle(board.toList).toArray
    }

    def guess(index: Int): Option[Color] = {
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

case class Square(word: String, color: Color, var revealed: Boolean = false)

object Square {
    def apply(): Square = {
        new Square("asdf", Color.GREY)
    }

    implicit val squareWrites: Writes[Square] = Json.writes[Square]
}

//case class Player(userID: Int, color: Color, role: Role)

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
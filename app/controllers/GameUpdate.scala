package controllers

import play.api.libs.json._

case class GameUpdate(updateType: String, userID: Int = 0, data: Option[JsValue] = None)

object GameUpdate {
    implicit val gameUpdateReads: Reads[GameUpdate] = Json.reads[GameUpdate]
    implicit val gameUpdateWrites: Writes[GameUpdate] = Json.writes[GameUpdate]
}

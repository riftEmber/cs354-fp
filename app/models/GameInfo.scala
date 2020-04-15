package models

import play.api.libs.json._

case class GameUpdate(updateType: String, userID: Int, data: JsValue)

object GameUpdate {
    implicit val gameUpdateReads: Reads[GameUpdate] = Json.reads[GameUpdate]
}

case class GameResponse(responseType: String, userID: Int = 0)

object GameResponse {
    implicit val gameResponseWrites: Writes[GameResponse] = Json.writes[GameResponse]
}

//class UpdateType private(val raw: String) extends AnyVal {
//    override def toString: String = raw
//}
//
//object UpdateType {
//    def apply(raw: String) = new UpdateType(raw)
//
//    implicit val updateTypeReads: Reads[UpdateType] = JsPath.read[String].map(UpdateType(_))
//    implicit val updateTypeWrites: Writes[UpdateType] = Writes {
//        (updateType: UpdateType) => JsString(updateType.raw)
//    }
//}
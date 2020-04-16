package controllers

import play.api.libs.json._

case class GameUpdate(updateType: String, userID: Int = 0, data: Option[JsObject] = None)

object GameUpdate {
    implicit val gameUpdateReads: Reads[GameUpdate] = Json.reads[GameUpdate]
    implicit val gameUpdateWrites: Writes[GameUpdate] = Json.writes[GameUpdate]
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
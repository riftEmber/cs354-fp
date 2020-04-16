$(document).ready(function () {
    const SECOND = 1000;

    if (!("WebSocket" in window)) {
        console.log("A browser supporting WebSockets is required");
        return;
    }
    const url = $("#game-script").attr("ws-url");
    let conn = new WebSocket(url);

    conn.onopen = function (event) {
        console.log("ws connection established");
        sendGameUpdate("hello", null)
        sendGameUpdate("guess", {index: 12})
        setInterval(() => sendGameUpdate("ping", null), 20 * SECOND);
    };

    conn.onmessage = (messageEvent) => receiveGameResponse(JSON.parse(messageEvent.data));

    conn.onclose = function (closeEvent) {
        if (closeEvent.wasClean) {
            console.log(`connection closed cleanly, code=${closeEvent.code} reason=${closeEvent.reason}`);
        } else {
            console.log(`connection closed unexpectedly, code=${closeEvent.code}`);
        }
    };

    conn.onerror = (error) => console.log(error);

    $(window).on('beforeunload', function () {
        sendGameUpdate("bye", null)
        conn.close();
    });

    function sendGameUpdate(updateType, data) {
        const jsonMessage = {updateType: updateType, userID: userID, data: data}
        const message = JSON.stringify(jsonMessage)
        console.log("sending message to server:", jsonMessage);
        conn.send(message);
    }

    function receiveGameResponse(jsonMessage) {
        console.log("received message from server:", jsonMessage);
        switch (jsonMessage.updateType) {
            case "hello":
                if (userID === -1) {
                    userID = jsonMessage.userID;
                }
                if (typeof jsonMessage.data !== "undefined") {
                    console.log("received game data");
                }
                break;
            case "pong":
                break;
            default:
                console.error(`illegal game update type ${jsonMessage.updateType}`)
        }
    }

    let userID = -1;

    console.log("client-side game code loaded");
});
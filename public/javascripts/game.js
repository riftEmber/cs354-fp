$(document).ready(function () {
    if (!("WebSocket" in window)) {
        console.log("A browser supporting WebSockets is required");
        return;
    }

    const url = $("#game-script").attr("ws-url");
    let conn = new WebSocket(url);

    conn.onopen = function (e) {
        console.log("ws connection established");
        send("test message");
        setInterval(function () {
            send("ping");
        }, 20 * 1000);
    };

    conn.onmessage = (event) => receive(event.data);

    conn.onclose = function (event) {
        if (event.wasClean) {
            console.log(`connection closed cleanly, code=${event.code} reason=${event.reason}`);
        } else {
            console.log(`connection closed unexpectedly, code=${event.code}`);
        }
    };

    conn.onerror = (error) => console.log(error);

    $(window).on('beforeunload', function () {
        conn.close();
    });

    function send(message) {
        console.log(`sending message to server: ${message}`);
        conn.send(message);
    }

    function receive(message) {
        console.log(`received message from server: ${message}`);
    }


    console.log("client-side game code loaded");
});
Final Project in Scala: *Codewords* ![Magnifying Glass Icon](https://raw.githubusercontent.com/riftEmber/cs354-fp/master/public/images/favicon.png "Codewords Icon")
========================
Dr. Kennington

Anna Rift

CS 354

2020-05-01

Running the Game
----------------
1. Codewords uses the build tool [sbt](https://www.scala-sbt.org/). Download
and install sbt from [here](https://www.scala-sbt.org/download.html).
2. I recommend using Java 8 for compatibility reasons. Newer versions are
likely to work, but Codewords was only tested with Java 8, and Scala may not
play as nice with them.
3. *(optional)* If you would like Codewords to retrieve random words from the
Wordnik API, an API key must be set (with `export`) in the environment
variable `WORDNIK_API_KEY`. Wordnik API keys can be requested
[here](https://developer.wordnik.com/). You could try using the key
`c23b746d074135dc9500c0a61300a3cb7647e53ec2b9b658e`, which is used for the
[samples in the documentation](https://developer.wordnik.com/docs#!/words/).
If no key is defined, a backup set of 25 words will be used. Note that
randomly retrieved words may be offensive.
4. *(optional)* The 'difficulty' of retrieved words can be adjusted by changing
the `WORD_MIN_DIFFICULTY` environment variable, which sets the
*minCorpusCount* parameter used in the call to the Wordnik API.
If not defined, the value of 20000 will be used. If word retrieval is not
being used (or fails), this option has no effect.
5. Clone this repository, navigate to the project root and run the command
`$ sbt run`. This may take an especially long time the first time it is run.
6. That's it! When sbt is done and the app is ready, the message `(Server
started, use Enter to stop and go back to the console...)` will appear on the
console. It can be viewed at <http://localhost:9000>. Compilation will be
triggered the first time the page is visited, so it will take an unusually
long time to load. Since the game is for 4 players, if you'd like to play by
yourself you'll need to open up four copies of the page.

Demonstration
-------------
A recorded demonstration of the game is available on YouTube
[here](https://youtu.be/qlVcWHjGn8E?t=344).

A live version of the app is hosted on Heroku
[here](https://infinite-mountain-96832.herokuapp.com/), for as long as I keep
it up (no guarantees). It has the random word retrieval functionality working.
This is the site used in the recorded demonstration. As the app only supports
one concurrent game, if other users are online at the same time as you they may
interfere (or you could play a round with them!).

# Omniturebot
A Node.js-powered Slack bot that cheerfully dispenses filtered website traffic figures upon request.

## Requirements
* A Node.js-enabled server or platform (I use Heroku).
* An Adobe Analytics/Omniture SiteCatalyst account with an API key.
* A Slack account with a bot name and token.

## Setup
1. Make a [new bot](https://my.slack.com/services/new/bot) in your Slack account. Make sure to note the bot's username and the resulting token.
2. Clone or download this repository.
3. Set up six environmental variables (either through config vars on Heroku or by using `export` in your command line): 
  * `USERNAME`: Your Omniture username. I've found that I've had to append my "company name" after a colon, i.e. `amcgill:Atlantic Media`.
  * `SECRET`: The secret token Omniture supplies on your user profile page.
  * `SERVER`: Your Omniture server location. (For instance, `sanJose`.)
  * `REPORTSUITEID`: The Omniture ID for the particular suite/website you want to track.
  * `BOT_NAME`: Your Slack bot's username.
  * `BOT_TOKEN`: The token Slack gave for your bot.
4. Start the server with `node index.js`, or push to Heroku/your SaaS platform.
5. Your bot should now be active in your Slack group!

## How to use
When you chat it a query, Omniturebot needs both a search term and a timespan, with the term in quotes and the timespan in parenthesis.

The search string is run against page titles. At The Atlantic, we append authors to page titles, so it's easy enough to search for `"andrew mcgill"`. If your organization doesn't, consider, changing `id` in the Omniture request section of `index.js` to `author` or however you track authorship.

The timespan should mention a number (numerals only, so `1`, not `one`) and a date element (`days`, `weeks`, `months`).

You can give both the query and the timespan in the same line, if you'd like: `"andrew mcgill" (2 weeks)`

Or you can give them one at a time:

&nbsp;&nbsp;&nbsp;&nbsp;`"andrew mcgill"` <br />
&nbsp;&nbsp;&nbsp;&nbsp;_omniturebot: OK, now I need a time element in parenthesis, like `(1 month)` or `(last 2 weeks)`._ <br />
&nbsp;&nbsp;&nbsp;&nbsp;`(1 month)`

Omniturebot will return the last 20 results matching that criteria, listing the number of unique visitors, pageviews and seconds spent per visitor. 
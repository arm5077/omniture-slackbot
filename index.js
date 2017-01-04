var SlackBot = require('slackbots');
var report = require('nomniture').Report;
var moment = require('moment');
var http = require('http'); 

http.createServer().listen(process.env.PORT || 5000);

var channels;
var users;
var requests = [];

// Initialize Omniture login
var r = new report(process.env.USERNAME, process.env.SECRET, process.env.SERVER, {
	waitTime: 5,
	log: false
});	

// Initialize bot
var bot = new SlackBot({
	token: process.env.BOT_TOKEN,
	name: process.env.BOT_NAME
});


bot.on('start', function(){ 
	var params = {
		icon_emoji: ':chart_with_upwards_trend:'
	}
	
	// First, get a list of all users
	bot.getUsers()
		.then(function(d){
			users = d.members;
			return 	bot.getChannels();
		})
		.then(function(d){
			// Now get a list of all channels
			var ids = d.channels.map(function(d){ return d.id })

			// When Slack signals a message has been sent...
			bot.on('message', function(message){

				// Only process if it's a message and it's NOT from the bot itself... don't need an infinite loop!
				if(message.type == 'message' && message.username != process.env.BOT_NAME){

					// See if this is a message to an existing channel;
					// if it's not, I'm going to assume it's a message to the bot?
					// Don't know if this is the right way to do this...
					if( ids.indexOf(message.channel) == -1 ){
						// Get the name of the person that chatted the bot
						userObj = users[users.map(function(d){ return d.id }).indexOf(message.user)];
						username = userObj.name;
						name = userObj.profile.real_name_normalized;
						first_name = userObj.profile.first_name;
						
						// Let's see what the person had to say
						console.log("From " + name + "(" + username + "): " + message.text);
						
						
						// If they asked for help, give it to them
						if( message.text.indexOf("help") == 0 ){
							bot_response = "I fetch traffic stats from Omniture for you! Give me a search term in quotes (author names work) and a time period in parenthesis and I'll get to work.";
							bot.postMessageToUser(username, bot_response);
							console.log("To " + name + ": " + bot_response )
						}
						
						// Otherwise, let's figure out their search query and timespan
						else {
							// Has this user already begun the question-asking process?
							if(requests.map(function(d){return d.username}).indexOf(username) == -1){
								// If, make a new user object for them and push it to the queue
								requests.push({ username: username, time: null, search: null });
								var user = requests[requests.length - 1];
							}
							else {
								var user = requests[requests.map(function(d){return d.username}).indexOf(username)];
							}
							
							// If they've already selected a time and a search string, let them eat cake.
							if( user.time && user.search){
								bot_response = "I'm already looking something up for you! You can ask me another question when I'm done with this one.";
								bot.postMessageToUser(username, bot_response);
								console.log("To " + name + ": " + bot_response )
							}
							else {
								// Look for a search string in quotes
								var search = new RegExp(/(“|")(.*?)(”|")/);
								if( search.test(message.text) ){
									var result = search.exec(message.text)[0].replace("“","").replace("”","").replace(/\"/g, "");
									user.search = result;
								} 

								// Look for a time element
								var search = new RegExp(/\((.*?)\)/);
								if( search.test(message.text) ){
									var result = search.exec(message.text)[0].replace("(","").replace(")","");
									
									// Grab numbers
									var search = new RegExp(/\d+/g);
									if( !search.test(result) ){
										bot_response = "Erg, I need my time elements to be numerals (`2`), not words (`two`).";
										bot.postMessageToUser(username, bot_response);										
										console.log("To " + name + ": " + bot_response );
									}
									else {
										var number =  search.exec(message.text)[0];
										// Find what kind of time element
										var time_element = "";
										if( message.text.indexOf("hour") != -1){
											time_element = "hours";
										} 
										else if( message.text.indexOf("day") != -1 ) {
											time_element = "days";
										}
										else if( message.text.indexOf("week") != -1 ){
											time_element = "weeks";
										}
										else if( message.text.indexOf("month") != -1 ){
											time_element = "months";
										}
										else if( message.text.indexOf("year") != -1 ){
											time_element = "years";
										}
										else {
											bot_response = "Doesn't look like there's a time element I understand. I understand `hours`, `days`, `weeks`, `months` and `years`.";
											bot.postMessageToUser(username, bot_response)
											console.log("To " + name + ": " + bot_response);
										}
									
										if(time_element){
											user.time = moment().subtract(number, time_element).format("YYYY-MM-DD");
										}
									
									}
								}
								
                // Look for Citylab tag (searches a different Omniture reporting suite)
                if( message.text.indexOf("[citylab]") == -1 )
                  var reportSuiteID = process.env.REPORTSUITEID;
                else
                  var reportSuiteID = process.env.ALTERNATE_REPORTSUITEID;

								if( user.time && user.search ){
									
									bot.postMessageToUser(username, "OK, searching for \"" + user.search + "\" since " + user.time + "...");
									
									// Make Omniture request
									r.request("Report.QueueRanked", {
										"reportDescription": {
									    "reportSuiteID": reportSuiteID,
									    "dateFrom": user.time,
									    "dateTo": moment().format('YYYY-MM-DD'),
									    "metrics": [{'id': "visitors"}, {'id': "pageviews"}, {'id': 'totalTimeSpent'}],
									    "elements": [
									      {
									        "id": "page",
									        "top": 20,
									        "search": {
									          "type": "OR",
									          "keywords": [user.search]
									        }
									      }
									    ]
									  }
									}, function(err, response){
										console.log(err);
										if(err) throw err;
										response = JSON.parse(response);

										
										if( response.report.data.length == 0 ){
											var bot_response = "Oops! No traffic data found."	
										}
										else {											
											var bot_response = "Here you go! :chart_with_upwards_trend: :computer:";
											response.report.data.forEach(function(story, i){
												var visitors = parseInt(story.counts[0]);
												var pageviews = parseInt(story.counts[1]);
												var totalTimeSpent = parseInt(story.counts[2]);
												bot_response += "\n>*" + story.name + "*\n>Visitors: `" + numberWithCommas(visitors) + "`      Pageviews: `" + numberWithCommas(pageviews) + "`      Time spent per visitor: `" + (Math.round(totalTimeSpent / visitors)) + " seconds`\n\n";
											});
										}

										// Remove username from the queue so they can make another request
										requests.splice(requests.indexOf(user),1);
										bot.postMessageToUser(username, bot_response);
										console.log("To " + name + ": " + bot_response)
									});
								}
								else {
									if(!user.search && !user.time)
										bot_response = "I don't get it! I need a search string in quotes (like `\"mark twain\"`) and a time element in parenthesis (like `(1 week)`)."
									else if(!user.time)
										bot_response = "OK, now I need a time element in parenthesis, like `(1 month)` or `(last 2 weeks)`.";
									else if(!user.search)
										bot_response = "Great, now I need a search string in quotes, like `\"mark twain\"`."
										
									bot.postMessageToUser(username, bot_response);
									console.log("To " + name + ": " + bot_response);
								}
								
							}
						}

					}
				}
			});
			
		})
	.done();
});


function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
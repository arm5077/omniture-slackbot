var SlackBot = require('slackbots');
var report = require('nomniture').Report;
var moment = require('moment');

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
						
						// If they asked for help, give it to them
						if( message.text.indexOf("help") == 0 ){
							bot.postMessageToUser(username, "I fetch traffic stats from Omniture for you! Give me a search term in quotes (author names work) and a time period in parenthesis and I'll get to work.");
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
								bot.postMessageToUser(username, "I'm already looking something up for you! You can ask me another question when I'm done with this one.");
							}
							else {
								// Look for a search string in quotes
								var search = new RegExp(/(“|")(.*?)(”|")/);
								if( search.test(message.text) ){
									var result = search.exec(message.text)[0].replace("“","").replace("”","").replace("\"", "");
									user.search = result;
								} 

								// Look for a time element
								var search = new RegExp(/\((.*?)\)/);
								if( search.test(message.text) ){
									var result = search.exec(message.text)[0].replace("(","").replace(")","");
									
									// Grab numbers
									var search = new RegExp(/\d+/g);
									if( !search.test(result) ){
										bot.postMessageToUser(username, "Erg, I need my time elements to be numerals (`2`), not words (`two`).");										
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
											bot.postMessageToUser(username, "Doesn't look like there's a time element I understand. I understand `hours`, `days`, `weeks`, `months` and `years`.")
										}
									
										if(time_element){
											user.time = moment().subtract(number, time_element).format("YYYY-MM-DD");
										}
									
									}
								}
								
								if( user.time && user.search ){
									
									bot.postMessageToUser(username, "OK, searching for \"" + user.search + "\" since " + user.time + "...");
									
									// Make Omniture request
									r.request("Report.QueueRanked", {
										"reportDescription": {
									    "reportSuiteID": process.env.REPORTSUITEID,
									    "dateFrom": user.time,
									    "dateTo": moment().format('YYYY-MM-DD'),
									    "metrics": [{'id': "pageviews"}],
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
										if(err) throw err;

										response = JSON.parse(response);

										if( response.report.data.length == 0 ){
											var botText = "Oops! No traffic data found."	
										}
										else {
											var botText = "Here you go! :chart_with_upwards_trend: :computer:";
											response.report.data.forEach(function(story, i){
												botText += "\n*" + story.name + "*: `" + numberWithCommas(story.counts[0]) + "`\n";
											});
										}

										// Remove username from the queue so they can make another request
										requests.splice(requests.indexOf(user),1);
										bot.postMessageToUser(username, botText);

									});
								}
								else {
									if(!user.search && !user.time)
										bot.postMessageToUser(username, "I don't get it! I need a search string in quotes (like `\"mark twain\"`) and a time element in parenthesis (like `(1 week)`).");
									else if(!user.time)
										bot.postMessageToUser(username, "OK, now I need a time element in parenthesis, like `(1 month)` or `(last 2 weeks)`.");
									else if(!user.search)
										bot.postMessageToUser(username, "Great, now I need a search string in quotes, like `\"mark twain\"`.");
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
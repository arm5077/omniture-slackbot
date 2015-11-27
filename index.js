var SlackBot = require('slackbots');
var report = require('nomniture').Report;
var moment = require('moment');

var channels;
var users;

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
	

	//bot.postMessageToUser('andrewmcgill', 'hola', params); 
	
	// First, get id of omniturebot
	
	bot.getUsers()
		.then(function(d){
			users = d.members;
			return 	bot.getChannels();
		})
		.then(function(d){
			
			var ids = d.channels.map(function(d){ return d.id })
			bot.on('message', function(d){
				// See if this is a message to an existing channel;
				// if it's not, I'm going to assume it's to the bot?
				if(d.type == 'message'){
					if( ids.indexOf(d.channel) == -1 ){

						// Get the name of the person that chatted the bot
						userObj = users[users.map(function(d){ return d.id }).indexOf(d.user)];
						username = users[users.map(function(d){ return d.id }).indexOf(d.user)].name;
						name = users[users.map(function(d){ return d.id }).indexOf(d.user)].profile.real_name_normalized;

						// Get their omniture stats
						r.request("Report.QueueRanked", {
							"reportDescription": {
						    "reportSuiteID": process.env.REPORTSUITEID,
						    "dateFrom": moment().subtract(7,"days").format("YYYY-MM-DD"),
						    "dateTo": moment().format('YYYY-MM-DD'),
						    "metrics": [{'id': "pageviews"}],
						    "elements": [
						      {
						        "id": "page",
						        "top": 5,
						        "search": {
						          "type": "OR",
						          "keywords": [name.toLowerCase()]
						        }
						      }
						    ]
						  }
						}, function(err, response){
							if(err) throw err;
							

							response = JSON.parse(response);
							
							
							// First, aggregate on URL.
							var botText = ":computer: *Omniture stats* :computer:";

							response.report.data.forEach(function(story, i){
								botText += "\n" + story.name + "\n" + story.url + "\n *" + numberWithCommas(story.counts[0]) + "*\n\n";
							});
							
							console.log(botText);
							
							bot.postMessageToUser(username, botText);
							
							
						});
						

					}
				}
			});
			
		})
	.done();

/*
	bot.getUser('andrewmcgill')
		.then(function(d){
			name = d.real_name_normalized;
		})
	.done();	
*/
});

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
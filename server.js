//npm imports
var express = require("express");
var mongoose = require("mongoose");
var cheerio = require("cheerio");
var request = require("request");
var bodyParser = require("body-parser");
var xhb = require("express-handlebars");

//import models
var db = require("./models");

//initialize express
var app = express();
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));

//if deployed, use deployed port, otherwise use 3000
var PORT = process.env.PORT || 3000;

//if deployed, use the deployed database, otherwise use the local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";

//setup handlebars
app.engine("handlebars", xhb({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

//set mongoose to leverage built in JavaScript ES6 Promises
mongoose.Promise = Promise;
//connect to the Mongo DB
mongoose.connect(MONGODB_URI, {useNewUrlParser: true});

//scraping logic
function scrape(cb) {
	request("https://www.polygon.com", function(err, response, body) {
		//array to hold all new article objects
		var articles = [];

		var $ = cheerio.load(body);
		$("div.c-entry-box--compact").each(function(i, element) {
			var newArticle = {};

			newArticle.title = $(this)
				.children("div.c-entry-box--compact__body")
				.children("h2")
				.children("a")
				.text();
			newArticle.link = $(this)
				.children("div.c-entry-box--compact__body")
				.children("h2")
				.children("a")
				.attr("href");
			newArticle.author = $(this)
				.children("div.c-entry-box--compact__body")
				.children("div.c-byline")
				.children("span.c-byline__item")
				.children("a")
				.text();
			newArticle.image = $(this)
				.children("a.c-entry-box--compact__image-wrapper")
				.children("picture")
				.children("img")
				.attr("src");
			
			//accounting for different image tags/structure
			if (!newArticle.image) {
				//for some reason these images' src attribute was returning base-64 URIs instead of useable URLs; this solution is a little hacky but seems to work consistently
				var srcText = $(this)
				.children("a.c-entry-box--compact__image-wrapper")
				.children("div")
				.children("noscript")
				.text();
				//the noscript tag's text contains the desired URL but with a bunch of html-like text before and after it; this slice extracts only the URL
				newArticle.image = srcText.slice(17, srcText.length-2);
			}

			//accounting for articles with no listed author
			if (!newArticle.author) {
				newArticle.author = "Polygon Staff"
			}

			//don't push broken entries, article-styled ads, and partner-site articles
			if (newArticle.link && newArticle.link.includes("polygon.com")) {
				articles.push(newArticle);
			}
		});
		
		//check for duplicates within new articles
		console.log("checking for scraped duplicates...");
		articles.forEach(function(e, i) {
			articles.forEach(function(f, j) {
				//if link is the same at a different index...
				if (i !== j && e.link === f.link ) {
					console.log("duplicate found!");
					//delete the duplicate
					articles.splice(j, 1);
					console.log("duplicate deleted.");
				}
			});
		});

		//check for duplicates in database
		console.log("checking for database duplicates...");
		db.Article.find({}, function(err, data) {
			data.forEach(function(e, i) {
				articles.forEach(function(f, j) {
					//if link matches one in the database...
					if (e.link === f.link) {
						console.log("duplicate found!");
						//delete the duplicate from the array
						articles.splice(j, 1);
						console.log("duplicate deleted.");
					}
				});
			});

			//add all new article objects to database
			db.Article.insertMany(articles, function(err, data) {
				console.log("database insertion completed.");
				
				cb(data);
			});
		});
	});
}

//home page routing
app.get("/", function(req, res) {
	//scrape(function() {
		var query = db.Article.find({}).sort("-_id").limit(24);
		query.exec(function(err, data) {
			if (err) throw err;
			
			res.render("index", { articles: data });
		});
	//});
});

//archive page
app.get("/archive", function(req, res) {
	var query = db.Article.find({}).sort("-_id");
	query.exec(function(err, data) {
		if (err) throw err;
			
		res.render("index", { articles: data });
	});
});

//comments page routing
app.get("/:id/comments", function(req, res) {
	db.Article.findOne({ "_id": req.params.id }).populate("comments").then(function(data) {
		res.render("comments", { article: data });
	});
});

//adding new comments
app.post("/api/:id/comments", function(req, res) {
	db.Comment.create(req.body).then(function(data) {
		return db.Article.findOneAndUpdate(
			{
				"_id": req.params.id
			}, {
				$push: {"comments": data._id}
			}, {
				new: true
			}
		);
	}).then(function(data) {
		res.json(data);
	});
});

//api page for getting new articles
app.get("/api/scrape", function(req, res) {
	scrape(function(newArticles) {
		res.json(newArticles);
	});
});

//deleting comments
app.delete("/api/comments/:id", function(req, res) {
	db.Comment.deleteOne({
		"_id": req.params.id
	}).then(function(data) {
		res.json(data);
	})
});

app.listen(PORT, function() {
	console.log("App running on port: " + PORT);
});
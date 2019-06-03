$(function() {
	//scrape new articles
	$("body").on("click", "#scrape-button", function(event) {
		//TODO: Disable this on comments page
		var button = event.target;
		console.log(button)

		$.ajax({
			method: "GET",
			url: "/api/scrape"
		}).then(function(data) {
			if (data.length === 0) {
				console.log("no new articles.");
				$(button).toggleClass("waiting");
				$(button).text("Get New Articles");
			} else {
					//add new articles to page
					data.forEach(function(article) {
						//build new div for each article with all information
						var newArticle = $("<div>");
						newArticle.attr("class", "article");
						newArticle.data("id", article._id);

						var articleImage = $("<img>");
						articleImage.attr("class", "article-image");
						articleImage.attr("alt", "Article Image");
						if (article.image) {
							articleImage.attr("src", article.image);
						} else {
							articleImage.attr("src", "/assets/images/placeholder.png");
						}

						var articleTitle = $("<a>");
						articleTitle.attr("class", "article-title");
						articleTitle.attr("href", article.link);
						articleTitle.text(article.title);

						var articleByline = $("<p>");
						articleByline.attr("class", "article-byline");
						articleByline.text(article.author);

						var commentButton = $("<a>");
						commentButton.attr("href", `/${article._id}/comments`);
						commentButton.data("id", article._id);

						//add new article to top of page
						newArticle.append(articleImage);
						newArticle.append(articleTitle);
						newArticle.append(articleByline);
						newArticle.append(commentButton);
						$(".articles-container").prepend(newArticle);

						$(button).toggleClass("waiting");
						$(button).text("Get New Articles");
					});
			}

		});

		$(button).toggleClass("waiting");
		$(button).text("Scraping...");
	});

	//submit comment form
	$("body").on("click", "#form-submit", function(event) {
		event.preventDefault();
		var articleId = $(".article").data("id");
		$.ajax({
			method: "POST",
			url: "/api/" +articleId +"/comments",
			data: {
				author: $("#form-author").val(),
				body: $("#form-body").val()
			}
		}).then(function() {
			location.reload();
		});
	});

	//delete comment
	$("body").on("click", ".comment-delete", function(event) {
		var commentId = $(this).data("id");

		$.ajax({
			method: "DELETE",
			url: "/api/comments/" +commentId
		}).then(function() {
			location.reload();
		});
	});
});
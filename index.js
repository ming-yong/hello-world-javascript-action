const { Toolkit } = require("actions-toolkit");
const axios = require("axios").default;
const core = require("@actions/core");
const dotenv = require("dotenv");
const btoa = require("btoa");
dotenv.config();

try {
	Toolkit.run(async (tools) => {
		//secrets
		const owner = process.env.REPO_OWNER;
		const key = process.env.DEV_API_KEY;
		const repo = process.env.REPO;
		//branch and PR info
		const today = new Date();
		const newBranchName = `dev-${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}-${today.getSeconds()}`;
		const newBranchRef = `refs/heads/${newBranchName}`;
		const postPath = "/content/blog/dev";
		const baseBranch = "master";
		const prTitle = `DEV posts ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
		let prNumber;
		let prArray;
		//fetch and create files
		let myPosts;
		let GETHeaders;
		let fetchPostContent;
		let fetchPostTitle;
		let fetchPostDate;
		let fetchPosts;
		let postDifference;
		let markdownFileName;
		let fileContents;
		let postTags;
		
		/**
		 * Create a branch
		 */
		const baseSHA = (
			await tools.github.repos.getBranch({
				owner,
				repo,
				branch: baseBranch,
			})
		).data.commit.sha;

		await tools.github.git.createRef({
			owner,
			repo,
			ref: newBranchRef,
			sha: baseSHA,
		});

		/**
		 * Get my posts
		 */
		myPosts = (
			await tools.github.repos.getContent({
				owner,
				repo,
				path: postPath,
			})
		).data;

		/**
		 * Create a markdown file for each post
		 */
		GETHeaders = {
			"Content-Type": "application/json",
			"api-key": `${key}`,
		};

		// Make the API calls
		const getData = () => {
			return axios({
				method: "get",
				url: "https://dev.to/api/articles/me?page=1&per_page=6",
				headers: GETHeaders,
			});
		};

		// Assign DEV data
		fetchPosts = (await getData()).data;
		postDifference = fetchPosts.length - myPosts.length;

		if (postDifference <= 0) {
			tools.exit.success("No post to add.");
		}

		for (let index = 0; index < postDifference; index++) {
			fetchPostDate = fetchPosts[index]["published_at"].slice(0, 10);
			fetchPostTitle = cleanString(fetchPosts[index]["title"])
				.toLowerCase()
				.split(" ")
				.join("-")
				.replace(/[^a-z0-9-]/gim, "")
				.replace(/\:/gi, "-");
			postTags = fetchPosts[index]["tag_list"];
			fetchPostContent = cleanString(fetchPosts[index]["body_markdown"]);
			markdownFileName = `${fetchPostDate}-${fetchPostTitle}.md`;

			// Create Markdown File
			fileContents = `      
+++
title = ${fetchPostTitle}
date = ${fetchPostDate}
description = ${fetchPosts[index]["description"]}
tags = ${postTags}
+++

${fetchPostContent}
			`.trim();

			// Remove extraneous indentation
			fileContents = fileContents.replace(/^ {4}/gm, "");

			// Encode it in Base64 Encoding
			const encodedContents = btoa(fileContents);

			// Create that file in our branch
			await tools.github.repos.createOrUpdateFileContents({
				owner,
				repo,
				path: `${postPath}/${markdownFileName}`,
				message: `New markdown file for ${fetchPostTitle}`,
				content: encodedContents,
				branch: newBranchName,
			});

			tools.log.success(`Post#${index + 1}: Added ${fetchPostTitle}!`);
		}

		/**
		 * Create or update a PR
		 */
		prArray = (
			await tools.github.pulls.list({
				owner,
				repo,
				head: baseBranch,
			})
		).data;
		prArray = prArray.filter((pr) => pr.title == prTitle);

		if (prArray.length > 0) {
			prNumber = prArray[0].number;
			await tools.github.pulls.update({
				owner,
				repo,
				pull_number: prNumber,
			});
			tools.log.success("PR updated");
		} else if (prArray.length == 0) {
			await tools.github.pulls.create({
				owner,
				repo,
				title: prTitle,
				head: newBranchName,
				base: baseBranch,
			});
			tools.log.success("PR created");
		}

		tools.exit.success("Done!");
	});
} catch (error) {
	core.setFailed(error.message);
}

function cleanString(input) {
	let output = "";
	for (let i = 0; i < input.length; i++) {
		if (input.charCodeAt(i) <= 127) {
			output += input.charAt(i);
		}
	}
	return output;
}

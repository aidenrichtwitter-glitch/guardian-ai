const {
  Given, When, Then
} = require('@cucumber/cucumber');
const puppeteer = require("puppeteer");


const port = process.env.PORT || 3000;
//Maybe change this
const appPage = `http://localhost:${port}/index.html`;

Given(
  "the presenter navigated to the application page",
  async function () {
    this.driver.get(appPage)
  }
);

Given('the presenter clicked the button {string}', function (string) {
  // Write code here that turns the phrase above into concrete actions
  return 'pending';
});







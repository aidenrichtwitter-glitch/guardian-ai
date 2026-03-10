import {
  setWorldConstructor
} from "@cucumber/cucumber"

import {WebDriver} from "selenium-webdriver"



//Creating the context for all the cucumber clauses in the 
//current scenario
class World {
  constructor() {
    this.pages = {};
    this.driver = new WebDriver()
    this.quit = this.WebDriver.quit();
  }

  setPage(name, page) {
    this.pages[name] = page;
  }

  getPage(name) {
    return this.pages[name];
  }
}

setWorldConstructor(World);
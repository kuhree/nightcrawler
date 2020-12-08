process.setMaxListeners(Infinity); // <== Important line

import chalk from 'chalk';
import puppeteer from 'puppeteer';

export const errorColor = chalk.bold.red;
export const successColor = chalk.keyword('green');
export const infoColor = chalk.keyword('cyan');
export const warningColor = chalk.keyword('orange');

export const onError = (error: Error) => {
  console.error(errorColor('❌: ' + error));
  throw error;
};
export const onSuccess = (msg: string) =>
  console.log(successColor('✅ : ' + msg));
export const onInfo = (msg: string) =>
  console.info(infoColor('🚀 : ' + msg));
export const onWarning = (msg: string) =>
  console.info(warningColor('🚧 : ' + msg));

export class Crawler {
  constructor(domain: string = process.argv[2]) {
    onSuccess('Good Vibes and greater Ventures');

    if (!domain) {
      onError(new Error('Domain is required'));
    }

    if (
      !/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/.test(
        domain,
      )
    ) {
      onError(new Error('Domain is invalid'));
    }

    this.domain = domain;
    this.domainName = domain.split('//')[1].split('.')[0];
    this.allRoutes = [domain];
    this.crawl(domain);
  }

  domain: string;
  domainName: string;
  pastRoutes: (string | null)[] = [];
  allRoutes: (string | null)[];
  browser: puppeteer.Browser | null = null;
  page: puppeteer.Page | null = null;

  wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async init() {
    // open a headless browser
    if (!this.browser) {
      onSuccess('Browser Opened');
      this.browser = await puppeteer.launch({ headless: true });
    }

    // open a new tab
    if (!this.page) {
      onSuccess('Tab Opened');
      this.page = await this.browser.newPage();
    }

    return { browser: this.browser, page: this.page };
  }

  async crawl(path: string) {
    const { page } = await this.init();

    try {
      if (!this.pastRoutes.includes(path)) {
        // goto page and add to pastRoutes
        onInfo(
          `Visiting ${path}: ${this.pastRoutes.indexOf(path)}/${
            this.allRoutes.length
          }`,
        );
        this.pastRoutes.push(path);
        await page.goto(path, { waitUntil: 'load', timeout: 0 });

        // take a screenshot
        onInfo(`Screenshotting ${path}`);
        await page.screenshot({
          path: `./screenshots/${this.domainName}/${path
            .replace(/http:\/\//gi, '')
            .replace(/https:\/\//gi, '')
            .replace(/\//gi, '-')}.png`,
          fullPage: true,
        });

        // gather local links
        onInfo(`Collecting pastRoutes on ${path}`);

        let localRoutes = await page?.evaluate(() =>
          Array.from(
            document.querySelectorAll("a[href^='/']"),
            (element) => element.getAttribute('href'),
          ),
        );

        localRoutes = localRoutes
          ?.filter((route) => route !== '/')
          .filter((route) => !this.pastRoutes.includes(route || ''));

        onInfo(
          `Routes found at ${page?.url()}\n` +
            localRoutes.map((route) => `    - ${route}`).join('\n'),
        );

        this.allRoutes.push(
          ...localRoutes.filter(
            (route) => this.allRoutes.indexOf(route || '') === -1,
          ),
        );

        // serializes
        await localRoutes.reduce(async (memo, route) => {
          await memo;

          await this.crawl(this.domain + route);
        }, this.wait(50));

        if (
          this.allRoutes
            .slice(1)
            .every(
              (route) =>
                this.pastRoutes.indexOf(`${this.domain}${route}`) !==
                -1,
            )
        ) {
          // close the tab
          onWarning('Tab Closed');
          this.page = null;
          await page?.close();

          // close the browser window
          onWarning('Browser Closed');
          return this.browser?.close();
        }
      } else {
        return onWarning(path + ' has already been visited');
      }
    } catch (error) {
      onError(error);
    }
  }
}

export default new Crawler(process.argv[2] || 'https://gvempire.dev');

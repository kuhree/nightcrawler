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
  console.log(successColor('✅: ' + msg));
export const onInfo = (msg: string) =>
  console.info(infoColor('🚀: ' + msg));
export const onWarning = (msg: string) =>
  console.info(warningColor('🚧:' + msg));

export class Crawler {
  constructor(domain: string = process.argv[2]) {
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
    this.crawl(domain);
  }

  domain: string;
  domainName: string;
  routes: string[] = [];
  browser: puppeteer.Browser | null = null;
  page: puppeteer.Page | null = null;

  wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async init() {
    // open a headless browser
    if (!this.browser) {
      onInfo('Browser Opened');
      this.browser = await puppeteer.launch({ headless: false });
    }

    // open a new tab
    if (!this.page) {
      onInfo('Tab Opened');
      this.page = await this.browser.newPage();
    }

    return { browser: this.browser, page: this.page };
  }

  async crawl(path: string) {
    const { page } = await this.init();

    try {
      if (!this.routes.includes(path)) {
        // goto page and add to routes
        onInfo(
          `Visiting ${path}: ${this.routes.indexOf(path)}/${
            this.routes.length
          } routes`,
        );
        this.routes.push(path);
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
        onInfo(`Collecting Routes on ${path}`);
        let localRoutes = await page?.evaluate(() =>
          Array.from(
            document.querySelectorAll('a[href^="/"]'),
            (element) => element.getAttribute('href'),
          ),
        );

        localRoutes = localRoutes
          ?.filter((route) => route !== '/')
          .filter((route) => !this.routes.includes(route || ''));

        onInfo(
          `Routes found at ${page?.url()}\n` +
            localRoutes.map((route) => `    - ${route}`).join('\n'),
        );

        // forEach link crawl if not in routes already
        for (let i = 0; i < localRoutes.length; i++) {
          const localRoute = localRoutes[i];

          await this.crawl(this.domain + localRoute);
        }

        onInfo(
          `All Routes: \n` +
            this.routes.map((route) => `    - ${route}`).join('\n'),
        );

        return localRoutes;
      } else {
        return onWarning(path + ' has already been visited');
      }
    } catch (error) {
      onError(error);
    } finally {
      // close the browser window
      onInfo('Tab Closed');
      await page?.close();
      this.page = null;
    }
  }
}

export default new Crawler(process.argv[2] || 'https://gvempire.dev');

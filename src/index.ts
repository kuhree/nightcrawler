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
export const onInfo = (msg: string) => console.info(infoColor(msg));
export const onWarning = (msg: string) =>
  console.info(warningColor('🚧 : ' + msg));

export class Crawler {
  constructor(domain: string = process.argv[2]) {
    onSuccess('Good Vibes and greater Ventures\n');

    if (!domain) {
      onError(new Error('Domain is required\n'));
    }

    if (
      !/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/.test(
        domain,
      )
    ) {
      onError(new Error('Domain is invalid\n'));
    }

    this.domain = domain;
    this.domainName = domain.split('//')[1].split('.')[0];
    this.allRoutes = [domain];
    console.time(infoColor('Time'));
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
      onSuccess('Browser Opened\n');
      this.browser = await puppeteer.launch({ headless: false });
    }

    // open a new tab
    if (this.browser && !this.page) {
      onSuccess('Tab Opened\n');
      this.page = await this.browser.newPage();
      process.argv[3] === '-i' &&
        (await this.page.emulate(puppeteer.devices['iPhone X']));
    }

    return { browser: this.browser, page: this.page };
  }

  async crawl(
    path: string,
    index?: string | number | (string | number)[],
  ) {
    const { page } = await this.init();
    const pathIndex =
      index ||
      `${this.allRoutes.indexOf(path)}/${this.allRoutes.length}`;

    // goto page and add to pastRoutes
    process.argv[4] === '-d' && onInfo(`${pathIndex} - ${path}\n`);

    try {
      if (!this.pastRoutes.includes(path)) {
        onInfo(`${pathIndex} - VISITNG - ${path}\n`);
        this.pastRoutes.push(path);
        await page?.goto(path, { waitUntil: 'load', timeout: 0 });

        // take a screenshot
        onInfo(`${pathIndex} - SCREENSHOT - ${path}\n`);
        await page?.screenshot({
          path: `./screenshots/${this.domainName}/${path
            .replace(/http:\/\//gi, '')
            .replace(/https:\/\//gi, '')
            .replace(/\//gi, '-')}.png`,
          fullPage: true,
        });

        // gather local links
        onInfo(`${pathIndex} - SEARCHING - ${path}\n`);

        let localRoutes = await page?.evaluate(() =>
          Array.from(
            document.querySelectorAll("a[href^='/']"),
            (element) => element.getAttribute('href'),
          ),
        );

        // filter out the landing-page and any routes we've already been to
        localRoutes = localRoutes
          ?.filter((route) => route !== '/')
          .filter((route) => route && !this.pastRoutes.includes(route));

        // put the `localRoutes` we just found and compare them to all the Routes
        this.allRoutes.push(
          ...(localRoutes?.filter(
            (route) => route && this.allRoutes.indexOf(route) === -1,
          ) || []),
        );

        if (localRoutes && localRoutes.length > 0) {
          onInfo(
            `${pathIndex} - FOUND - ${path}\n` +
              localRoutes.map((route) => `\t- ${route}`).join('\n') +
              '\n',
          );
        }

        // Serializes the async/await array.
        // Creates a slight pause as we move through the web.
        await localRoutes?.reduce(async (memo, route) => {
          await memo;

          await this.crawl(this.domain + route);
        }, this.wait(50));

        // Are we done?
        // Does every route from `allRoutes` have a match in the `pastRoutes`
        //   we've been to?
        if (
          this.allRoutes
            .slice(1)
            .every(
              (route) =>
                this.pastRoutes.indexOf(`${this.domain}${route}`) !==
                -1,
            )
        ) {
          // if so,
          // close the tab
          onWarning('Tab Closing');
          this.page = null;
          await page?.close();

          // close the browser window
          onWarning('Browser Closing');
          console.timeEnd(infoColor('Time'));
          return this.browser?.close();
        }
      }
    } catch (error) {
      onError(error);
    }
  }
}

export default new Crawler(process.argv[2] || 'https://gvempire.dev');

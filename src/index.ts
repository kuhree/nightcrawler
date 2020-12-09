process.setMaxListeners(Infinity); // <== Important line

import chalk from 'chalk';
import fs from 'fs';
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

/**
 * # Crawler
 * @packageDescription
 *
 * @param args
 * Crawler [type]
 * -s <username> // Search social media sites for given username
 * -c <domain> // Crawl linked pages on a given domain and screenshot
 *
 * - Example
 * yarn
 *
 */
export class Crawler {
  constructor(options = process.argv) {
    onSuccess('Crawler Loading...\n');
    onSuccess('Good Vibes and Greater Ventures\n');

    if (options[2] === '-c' || options[2] === '--crawl') {
      const domain = options[3];

      if (
        !domain ||
        !/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/.test(
          domain,
        )
      ) {
        onError(new Error('Domain is invalid\n'));
      }

      this.domain = domain;
      this.domainName = domain.split('//')[1].split('.')[0];
      this.allRoutes = [domain];
      console.time(infoColor('crawl'));

      onSuccess(`Crawl starting on ${domain}\n`);
      this.crawl(domain);
    }

    if (options[2] === '-s' || options[2] === '--search') {
      const username = options[3];

      if (!username) {
        onError(new Error('Username is invalid\n'));
      }

      this.username = username;
      this.domainName = username.split('@')[1];
      console.time(infoColor('search'));

      onSuccess(`Crawl starting on ${username}\n`);
      this.search(username);
    }
  }

  browser: puppeteer.Browser | null = null;
  page: puppeteer.Page | null = null;

  // for searching
  username?: string;
  socialMediaRefs: Array<{
    key: string;
    href: string | ((username: string) => string);
  }> = [
    { key: 'twitter', href: 'https://twitter.com/' },
    { key: 'instagram', href: 'https://instagram.com/' },
    { key: 'facebook', href: 'https://facebook.com/' },
    { key: 'linkedin', href: 'https://linkedin.com/in/' },
  ];

  // for crawling
  domain?: string;
  domainName?: string;
  pastRoutes: (string | null)[] = [];
  allRoutes?: (string | null)[];

  wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async createFolder(path: string) {
    try {
      if (!fs.existsSync(__dirname + path)) {
        fs.mkdirSync(__dirname + path, { recursive: true });
      }
    } catch (err) {
      onError(err);
    }
  }

  async screenshot(name: string) {
    this.page?.screenshot({
      path: __dirname + `/screenshots/` + name,
      fullPage: true,
    });
  }

  async init() {
    // open a headless browse
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

  async exit() {
    // close the tab
    onWarning('Tab Closing');
    await this.page?.close();
    this.page = null;

    // close the browser window
    onWarning('Browser Closing');
    this.browser?.close();
    this.browser = null;
  }

  async crawl(
    path: string,
    index?: string | number | (string | number)[],
  ) {
    const { page } = await this.init();

    const pathIndex =
      index ||
      `${this.allRoutes?.indexOf(path)}/${this.allRoutes?.length}`;

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
        this.allRoutes?.push(
          ...(localRoutes?.filter(
            (route) => route && this.allRoutes?.indexOf(route) === -1,
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

          if (
            route &&
            !/(login|sign-in|sign-up|sign in|sign up|register)/gi.test(
              route,
            )
          ) {
            await this.crawl(this.domain + route);
          }
        }, this.wait(1024));

        // Are we done?
        // Does every route from `allRoutes` have a match in the `pastRoutes`
        //   we've been to?
        if (
          this.allRoutes
            ?.slice(1)
            .every(
              (route) =>
                this.pastRoutes.indexOf(`${this.domain}${route}`) !==
                -1,
            )
        ) {
          console.timeEnd(infoColor('crawl'));
          this.exit();
        }
      }
    } catch (error) {
      onError(error);
    }
  }

  /**
   * Search
   * Given a username, grab a screen shot of user profiles across different
   *  social media platforms
   *    - Twitter
   *    - Facebook
   *    - LinkedIn
   *
   * @todo add recursive search functionaility
   * @todo add top media interests functionality
   */
  async search(username: string, index?: number) {
    const { page } = await this.init();

    try {
      await this.socialMediaRefs?.reduce(async (memo, smRef, i) => {
        await memo;

        const pathIndex = `${username} | ${this.socialMediaRefs[i].key}`;
        await this.createFolder(`/screenshots/${username}/`);

        const url =
          typeof smRef.href === 'function'
            ? smRef.href(username)
            : smRef.href + username;

        onInfo(`${pathIndex} - VISITNG - ${url}\n`);
        await page?.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 0,
        });

        onInfo(`${pathIndex} - SCREENSHOT - ${url}\n`);
        await page?.screenshot({
          path:
            __dirname +
            `/screenshots/${username}/${this.socialMediaRefs[i].key}.png`,
          fullPage: true,
        });

        switch (smRef.key) {
          case 'twitter': {
            onInfo('Twitter Captured');
            break;
          }
          case 'instagram': {
            onInfo('Instagram Captured');
            break;
          }
          case 'facebook': {
            onInfo('Facebook Captured');
            break;
          }
          case 'linkedin': {
            onInfo('LinkedIn Captured');
            break;
          }
          default: {
            break;
          }
        }
      }, this.wait(1024));
    } catch (error) {
      onError(error);
    } finally {
      console.time(infoColor('search'));
      this.exit();
    }
  }
}

export default new Crawler(process.argv);

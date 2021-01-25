process.setMaxListeners(Infinity); // <== Important line
import chalk from 'chalk';
import fs from 'fs';
import puppeteer from 'puppeteer';
import '../env.js';

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
export const onInfo = (msg: string) => console.info(infoColor('🚀 : ' + msg));
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
    onSuccess('Crawler Loading...');
    onSuccess('Good Vibes and Greater Ventures');

    if (options[2] === '-c' || options[2] === '--crawl') {
      const domain = options[3];

      if (
        !domain ||
        !/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/.test(
          domain,
        )
      ) {
        onError(new Error('Domain is invalid'));
      }

      this.domain = domain;
      this.domainName = domain.split('//')[1].split('.')[0];
      this.allRoutes = [domain];
      console.time(infoColor('crawl'));

      onSuccess(`Crawl starting on ${domain}`);
      this.crawl(domain);
    }

    if (options[2] === '-s' || options[2] === '--search') {
      const username = options[3];

      if (!username) {
        onError(new Error('Username is invalid'));
      }

      this.username = username;
      this.domainName = username.split('@')[1];
      console.time(infoColor('search'));

      onSuccess(`Crawl starting on ${username}`);
      this.search(username);
    }

    if (options[2] === '-r' || options[2] === '--reddit') {
      const subreddit = options[3];

      if (!subreddit) {
        onError(new Error('Subreddit is invalid'));
      }

      this.subreddit = subreddit;
      console.time(infoColor('search'));

      onSuccess(`Reddit starting on ${subreddit}`);
      this.reddit(subreddit);
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
    { key: 'github', href: 'https://github.com/' },
  ];

  // for crawling
  domain?: string;
  domainName?: string;
  pastRoutes: (string | null)[] = [];
  allRoutes?: (string | null)[];

  // for reddit
  subreddit?: string;

  wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async createFolder(path: string) {
    try {
      if (!fs.existsSync(__dirname + path)) {
        fs.mkdirSync(__dirname + path, { recursive: true });
      }
    } catch (error) {
      onError(error);
    }
  }

  async createFile(path: string, data: string) {
    try {
      fs.writeFile(path, data, (err) => {
        if (err) return onError(err);
      });
    } catch (error) {
      onError(error);
    }
  }

  async init() {
    // open a headless browser
    if (!this.browser) {
      onSuccess('Browser Opened');
      this.browser = await puppeteer.launch({
        headless: false,
        args: ['--startMaximized'],
        slowMo: 20,
      });
    }

    // open a new tab
    if (this.browser && !this.page) {
      onSuccess('Tab Opened');
      this.page = await this.browser.newPage();

      // set viewport and user agent (just in case for nice viewing)
      await this.page.setViewport({
        width: 1366,
        height: 768,
      });
      await this.page.setUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36',
      );

      // set the HTTP Basic Authentication credential
      await this.page.authenticate({
        username: process.env.USERNAME || '',
        password: process.env.PASSWORD || '',
      });

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

  async crawl(path: string, index?: string | number | (string | number)[]) {
    const { page } = await this.init();

    const pathIndex =
      index || `${this.allRoutes?.indexOf(path)}/${this.allRoutes?.length}`;

    process.argv[4] === '-d' && onInfo(`${pathIndex} - ${path}`);

    try {
      if (!this.pastRoutes.includes(path)) {
        // goto page and add to pastRoutes
        onInfo(`${pathIndex} - VISITNG - ${path}`);
        this.pastRoutes.push(path);
        await page?.goto(path, {
          waitUntil: 'networkidle0',
          timeout: 0,
        });

        const screenshotPath =
          `/` +
          path
            .replace(/http:\/\//gi, '')
            .replace(/https:\/\//gi, '')
            .replace(/\.[a-zA-z1-9]*/i, '');

        await this.createFolder(screenshotPath);

        // take a screenshot
        onInfo(`${pathIndex} - SCREENSHOT - ${path}`);
        await page?.screenshot({
          path: `${__dirname}/${screenshotPath}/screenshot.png`,
          fullPage: true,
        });

        // get html
        onInfo(`${pathIndex} - SCRAPING - ${path}`);
        const html = await page?.evaluate(
          () => document.querySelector('*')?.outerHTML,
        );
        html &&
          this.createFile(`${__dirname}/${screenshotPath}/index.html`, html);

        // gather local links
        onInfo(`${pathIndex} - SEARCHING - ${path}`);
        let localRoutes = await page?.evaluate(() =>
          Array.from(document.querySelectorAll("a[href^='/']"), (element) =>
            element.getAttribute('href'),
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
            `${pathIndex} - FOUND - ${path}` +
              localRoutes.map((route) => `\t- ${route}`).join('\n') +
              '\n',
          );

          // store relative links
          this.createFile(
            `${__dirname}/${screenshotPath}/link.json`,
            JSON.stringify(
              { links: localRoutes, allRoutes: this.allRoutes },
              null,
              2,
            ),
          );
        }

        // Serializes the async/await array.
        // Creates a slight pause as we move through the web.
        await localRoutes?.reduce(async (memo, route) => {
          await memo;

          if (route) {
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
                this.pastRoutes.indexOf(`${this.domain}${route}`) !== -1,
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

        const pathIndex = `${username} | ${smRef.key}`;
        await this.createFolder(`/${username}/${smRef.key}`);

        const url =
          typeof smRef.href === 'function'
            ? smRef.href(username)
            : smRef.href + username;

        onInfo(`${pathIndex} - VISITNG - ${url}`);
        await page?.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 0,
        });

        onInfo(`${pathIndex} - SCREENSHOT - ${url}`);
        await page?.screenshot({
          path: __dirname + `/${username}/${smRef.key}/screenshot.png`,
          fullPage: true,
        });

        // get html
        onInfo(`${pathIndex} - SCRAPING - ${url}`);
        const html = await page?.evaluate(
          () => document.querySelector('*')?.outerHTML,
        );
        html &&
          this.createFile(
            `${__dirname}/${username}/${smRef.key}/index.html`,
            html,
          );
      }, this.wait(1024));
    } catch (error) {
      onError(error);
    } finally {
      console.timeEnd(infoColor('search'));
      this.exit();
    }
  }

  /**
   * Reddit
   * Given a subreddit, download all images and videos
   */
  async reddit(subreddit: string, index?: number) {
    const { page } = await this.init();

    try {
      const url = 'https://reddit.com/r/' + subreddit + '/top';
      const pathIndex = `${subreddit}`;
      await this.createFolder(`/${subreddit}`);

      onInfo(`${pathIndex} - VISITNG - ${url}`);
      await page?.goto(url, { waitUntil: 'networkidle0', timeout: 0 });

      onInfo(`${pathIndex} - SCREENSHOT - ${url}`);
      await page?.screenshot({
        path: __dirname + `/${subreddit}/screenshot.png`,
        fullPage: true,
      });

      // gather local links
      onInfo(`${pathIndex} - Getting images - ${url}`);
      let localImages = await page?.evaluate(() =>
        Array.from(document.querySelectorAll('img'), (element) => ({
          alt: element.getAttribute('alt'),
          poster: element.getAttribute('poster'),
          src: element.getAttribute('src'),
        })),
      );

      localImages = localImages?.filter((image) => image.alt?.includes('Post'));

      onInfo(`${pathIndex} - Getting videos - ${url}`);
      const localVideos = await page?.evaluate(() =>
        Array.from(document.querySelectorAll('video'), (element) => ({
          poster: element.getAttribute('poster'),
          src: element.getAttribute('src'),
        })),
      );

      if (localImages && localImages.length > 0) {
        onInfo(
          `${pathIndex} - Images FOUND - ${url}` +
            localImages.map((image) => `\t- ${image.src}`).join('\n') +
            '\n',
        );

        // store images
        this.createFile(
          `${__dirname}/${pathIndex}/images.json`,
          JSON.stringify(localImages, null, 2),
        );
      }

      if (localVideos && localVideos.length > 0) {
        onInfo(
          `${pathIndex} - Videos FOUND - ${url}` +
            localVideos.map((video) => `\t- ${video.src}`).join('\n') +
            '\n',
        );

        // store videos
        this.createFile(
          `${__dirname}/${pathIndex}/videos.json`,
          JSON.stringify(localVideos, null, 2),
        );
      }
    } catch (error) {
      onError(error);
    } finally {
      console.timeEnd(infoColor('search'));
      this.exit();
    }
  }
}

export default new Crawler(process.argv);

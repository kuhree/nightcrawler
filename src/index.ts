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

export async function puppCall(
  fn: ({
    browser,
    page,
  }: {
    browser: puppeteer.Browser;
    page: puppeteer.Page;
  }) => Promise<any>,
  options?: puppeteer.LaunchOptions,
  defaultBrowser?: puppeteer.Browser,
  defaultPage?: puppeteer.Page,
) {
  let browser: puppeteer.Browser | null = null;

  try {
    // onInfo('Browser Opened');
    // open a headless browser
    browser =
      defaultBrowser ||
      (await puppeteer.launch({ headless: true, ...options }));
    // open a new page (tab?)
    const page = defaultPage || (await browser.newPage());

    await fn({ browser, page });
  } catch (error) {
    onError(error);
  } finally {
    // close the browser window
    await browser?.close();
    // onInfo('Browser Closed');
  }
}

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

  wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async crawl(path: string) {
    await puppCall(
      async ({ page }) => {
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
        } else {
          onWarning(path + ' has already been visited');
        }
      },
      { headless: true },
    );
  }
}

export default new Crawler(process.argv[2]);

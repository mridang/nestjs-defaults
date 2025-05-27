/* eslint-disable tailwindcss/no-custom-classname */

import { FunctionalComponent } from 'preact';
import { HttpStatus } from '@nestjs/common';
import { render } from 'preact-render-to-string';

const errors: Record<
  number,
  {
    statusCode: number;
    errorType: string;
    errorMessage: string;
  }
> = {
  [HttpStatus.BAD_REQUEST]: {
    statusCode: HttpStatus.BAD_REQUEST,
    errorType: 'Bad Request',
    errorMessage:
      'The server cannot process the request due to a client error.',
  },
  [HttpStatus.UNAUTHORIZED]: {
    statusCode: HttpStatus.UNAUTHORIZED,
    errorType: 'Unauthorized',
    errorMessage: 'Please log in to access this resource.',
  },
  [HttpStatus.PAYMENT_REQUIRED]: {
    statusCode: HttpStatus.PAYMENT_REQUIRED,
    errorType: 'Payment Required',
    errorMessage: 'Please provide payment to access this resource.',
  },
  [HttpStatus.FORBIDDEN]: {
    statusCode: HttpStatus.FORBIDDEN,
    errorType: 'Forbidden',
    errorMessage: 'You do not have permission to access this resource.',
  },
  [HttpStatus.NOT_FOUND]: {
    statusCode: HttpStatus.NOT_FOUND,
    errorType: 'Not Found',
    errorMessage: 'The requested resource could not be found.',
  },
  [HttpStatus.METHOD_NOT_ALLOWED]: {
    statusCode: HttpStatus.METHOD_NOT_ALLOWED,
    errorType: 'Method Not Allowed',
    errorMessage: 'The requested method is not allowed for this resource.',
  },
  [HttpStatus.NOT_ACCEPTABLE]: {
    statusCode: HttpStatus.NOT_ACCEPTABLE,
    errorType: 'Not Acceptable',
    errorMessage:
      'The requested resource is not available in a format acceptable to the client.',
  },
  [HttpStatus.PROXY_AUTHENTICATION_REQUIRED]: {
    statusCode: HttpStatus.PROXY_AUTHENTICATION_REQUIRED,
    errorType: 'Proxy Authentication Required',
    errorMessage: 'Please authenticate with the proxy.',
  },
  [HttpStatus.REQUEST_TIMEOUT]: {
    statusCode: HttpStatus.REQUEST_TIMEOUT,
    errorType: 'Request Timeout',
    errorMessage: 'The server timed out waiting for the request.',
  },
  [HttpStatus.CONFLICT]: {
    statusCode: HttpStatus.CONFLICT,
    errorType: 'Conflict',
    errorMessage:
      'The request could not be completed due to a conflict with the current state of the resource.',
  },
  [HttpStatus.GONE]: {
    statusCode: HttpStatus.GONE,
    errorType: 'Gone',
    errorMessage:
      'The requested resource is no longer available on the server.',
  },
  [HttpStatus.INTERNAL_SERVER_ERROR]: {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    errorType: 'Internal Server Error',
    errorMessage: 'An unexpected error occurred on the server.',
  },
  [HttpStatus.NOT_IMPLEMENTED]: {
    statusCode: HttpStatus.NOT_IMPLEMENTED,
    errorType: 'Not Implemented',
    errorMessage:
      'The server does not support the functionality required to fulfill the request.',
  },
  [HttpStatus.BAD_GATEWAY]: {
    statusCode: HttpStatus.BAD_GATEWAY,
    errorType: 'Bad Gateway',
    errorMessage:
      'The server received an invalid response from the upstream server.',
  },
  [HttpStatus.SERVICE_UNAVAILABLE]: {
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    errorType: 'Service Unavailable',
    errorMessage:
      'The server is currently unable to handle the request due to temporary overloading or maintenance.',
  },
  [HttpStatus.GATEWAY_TIMEOUT]: {
    statusCode: HttpStatus.GATEWAY_TIMEOUT,
    errorType: 'Gateway Timeout',
    errorMessage:
      'The server did not receive a timely response from the upstream server.',
  },
};

const ErrorPage: FunctionalComponent<{
  httpStatus: HttpStatus;
}> = ({ httpStatus }) => {
  const errorInfo = errors[httpStatus] || {
    statusCode: httpStatus,
    errorType: 'Unknown Error',
    errorMessage: 'An unexpected error occurred.',
  };

  return (
    <html lang="en">
      <head>
        <title>{errorInfo.errorType}</title>
        <meta
          content="width=device-width, minimum-scale=1, maximum-scale=1"
          name="viewport"
        />
        <link rel="icon" type="image/x-icon" href="/static/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        ></link>
        <style>{`
          /* CSS reset */
          html, body, div, span, applet, object, iframe,
          h1, h2, h3, h4, h5, h6, p, blockquote, pre,
          a, abbr, acronym, address, big, cite, code,
          del, dfn, em, img, ins, kbd, q, s, samp,
          small, strike, strong, sub, sup, tt, var,
          b, u, i, center,
          dl, dt, dd, ol, ul, li,
          fieldset, form, label, legend,
          table, caption, tbody, tfoot, thead, tr, th, td,
          article, aside, canvas, details, embed,
          figure, figcaption, footer, header, hgroup,
          menu, nav, output, ruby, section, summary,
          time, mark, audio, video {
            margin: 0;
            padding: 0;
            border: 0;
            font-size: 100%;
            font: inherit;
            vertical-align: baseline;
          }

          article, aside, details, figcaption, figure,
          footer, header, hgroup, menu, nav, section {
            display: block;
          }

          body {
            line-height: 1;
          }

          ol, ul {
            list-style: none;
          }

          blockquote, q {
            quotes: none;
          }

          blockquote:before, blockquote:after,
          q:before, q:after {
            content: '';
            content: none;
          }

          table {
            border-collapse: collapse;
            border-spacing: 0;
          }

          /* Style */
          html,
          body {
            font-family: Montserrat, sans-serif;
            font-size: 16px;
            line-height: 1.4;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }

          body {
            height: 100%;
            background: #ffffff;
            -webkit-user-select: none;
              -moz-user-select: none;
                -ms-user-select: none;
                    user-select: none;
          }

          main {
            height: calc(100% - 50px);
            padding: 25px;
            display: -webkit-box;
            display: -ms-flexbox;
            display: flex;
            -webkit-box-orient: vertical;
            -webkit-box-direction: normal;
                -ms-flex-direction: column;
                    flex-direction: column;
            -webkit-box-pack: center;
                -ms-flex-pack: center;
                    justify-content: center;
            -webkit-box-align: center;
                -ms-flex-align: center;
                    align-items: center;
            text-align: center;
          }

          main .main_error-code {
            font-size: calc(4.86188vw + 65.76796px);
            line-height: 1;
            text-transform: uppercase;
            color: #191919;
          }

          @media screen and (max-width: 374px) {
            main .main_error-code {
              font-size: 84px;
            }
          }

          @media screen and (min-width: 1281px) {
            main .main_error-code {
              font-size: 128px;
            }
          }

          main .main_error-title {
            font-size: calc(0.88398vw + 18.68508px);
            text-transform: capitalize;
            color: #191919;
            margin-bottom: calc(0.44199vw + 18.34254px);
          }

          @media screen and (max-width: 374px) {
            main .main_error-title {
              font-size: 22px;
            }
          }

          @media screen and (min-width: 1281px) {
            main .main_error-title {
              font-size: 30px;
            }
          }

          @media screen and (max-width: 374px) {
            main .main_error-title {
              margin-bottom: 20px;
            }
          }

          @media screen and (min-width: 1281px) {
            main .main_error-title {
              margin-bottom: 24px;
            }
          }

          main .main_error-message {
            font-size: calc(0.44199vw + 14.34254px);
            color: #191919;
          }

          @media screen and (max-width: 374px) {
            main .main_error-message {
              font-size: 16px;
            }
          }

          @media screen and (min-width: 1281px) {
            main .main_error-message {
              font-size: 20px;
            }
          }

          main .main_error-message:last-of-type {
            margin-bottom: calc(0.44199vw + 18.34254px);
          }

          @media screen and (max-width: 374px) {
            main .main_error-message:last-of-type {
              margin-bottom: 20px;
            }
          }

          @media screen and (min-width: 1281px) {
            main .main_error-message:last-of-type {
              margin-bottom: 24px;
            }
          }

          main .main_error-link {
            display: inline-block;
            font-size: calc(0.22099vw + 13.17127px);
            font-weight: 700;
            text-transform: capitalize;
            text-decoration: none;
            background: #191919;
            color: #ffffff;
            padding: 10px 25px;
            border: 2px solid #191919;
            border-radius: 0;
            -webkit-transition: background .3s ease, color .3s ease;
            transition: background .3s ease, color .3s ease;
          }

          @media screen and (max-width: 374px) {
            main .main_error-link {
              font-size: 14px;
            }
          }

          @media screen and (min-width: 1281px) {
            main .main_error-link {
              font-size: 16px;
            }
          }

          main .main_error-link:hover {
            background: #ffffff;
            color: #191919;
          }
        `}</style>
      </head>
      <body>
        <main>
          <h2 className="main_error-code">{errorInfo.statusCode}</h2>
          <h1 className="main_error-title">{errorInfo.errorType}</h1>
          <p className="main_error-message">{errorInfo.errorMessage}</p>
          <p className="main_error-message">
            We are sorry for the inconvenience.
          </p>
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a
            className="main_error-link"
            href="javascript:window.history.back();"
          >
            Go back
          </a>
        </main>
      </body>
    </html>
  );
};

export default (httpStatus: number) =>
  render(<ErrorPage httpStatus={httpStatus} />);

import winston from 'winston';

const isDev = process.env.NODE_ENV !== 'production';

const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: isDev
    ? winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          // Support logger.info({ key: val }) — no message field, whole object is the payload
          const payload = typeof message === 'object'
            ? JSON.stringify(message)
            : `${message}${Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''}`;
          return `${timestamp} ${level}: ${payload}`;
        })
      )
    : winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
  transports: [new winston.transports.Console()],
});

export default logger;

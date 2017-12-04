import amqp from 'amqplib/callback_api';
import { logger, logger_date } from './src/log4j';
import config from './config';
import route from './route';
import { RabbitSend } from './rabbitMQ';
import { Cache } from './util';
import packages from './package.json';

logger.info('server started');

global.msgQueue = [];
global.resolveRabbit = {};
global.readyListener = [];

function bail(err, conn) {
  logger.error(err);
}

function initServer(ch, ok) {
  const server = new RabbitSend(ch, ok)
  return server;
}

function assertQueue(ch, q) {
  return new Promise((resolve, reject) => {
    ch.assertQueue(q, {durable: true}, (err, ok) => {
      if (err !== null) return bail(err);
      global.ch = ch;
      global.ok = ok;
      global.server = initServer;
      resolve();
    });
  });
}

function mq() {
  return global.server(global.ch, global.ok);
}

function delQueues(ch) {
  Cache.getCache(`${packages.name}-mq`).then((res) => {
    if (res) {
      logger.warn('================ start clear mq queues =================');
      Cache.destroy(`${packages.name}-mq`);
      const queues = res.rabbitmq_queues.queues;
      queues.map((key) => {
        ch.checkQueue(key, (err, ok) => {
          if (ok.queue === key) {
            logger.warn(`================== delete queue ${key} ==================`);
            ch.deleteQueue(key);
          }
        });
      });
    }
  });
}

function on_connect(err, conn) {
    if (err !== null)
        return bail(err);

    process.once('SIGINT', () => {
        conn.close();
    });

    var q = config.rabbitMq_queue.logic01

    /*
    测试mq
     */
    // var q = config.rabbitMq_queue.logic02

    global.readyListener.push(q);

    conn.createChannel((err, ch) => {
        logger_date.info('rabbitMQ createChannel');
        delQueues(ch);
        assertQueue(ch, q).then(() => {
          ch.prefetch(1);
          ch.consume(q, reply, {
              noAck: false
          }, (err) => {
              if (err !== null)
                  return bail(err, conn);
              logger.info(' [x] Awaiting RPC requests');
          });

          function reply(msg) {
              logger.info('request content is ' + msg.content.toString());
              const request = JSON.parse(msg.content.toString());
              const cb = (response) => {
                  ch.sendToQueue(msg.properties.replyTo, new Buffer(JSON.stringify(response)), { correlationId: msg.properties.correlationId });
                  ch.ack(msg);
              };
              try {
                const func = request.class && request.func ? route[request.class][request.func] : null;
                if (func) {
                  func(cb, request.content, mq);
                } else {
                  cb({
                    err: 'method not allowed'
                  });
                }
              } catch(err) {
                console.log(err);
                cb({
                  code: 500,
                  err: 'server error'
                });
              }
          }
        });
    });
}

amqp.connect('amqp://' + config.rabbitMq_user + ':' + config.rabbitMq_password + '@' + config.rabbitMq_host + ':' + config.rabbitMq_port, on_connect);
logger_date.info('rabbitMQ connect success');
logger.warn('don`t kill this process');

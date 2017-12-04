import config from './config.json';
import uuid from 'node-uuid';
import autobind from 'autobind-decorator'
import { Cache } from '../util';
import packages from '../package.json';

const id = uuid();

@autobind
export default class RabbitSend {
  constructor(ch, ok) {
    this.ch = ch;
    this.ok = ok;
    this.pid = id;
  }

  mabeAnswer(msg) {
    if (global.msgQueue.includes(msg.properties.correlationId)) {
      console.log(`receive msg is ${msg.content.toString()}`);
      const index = global.msgQueue.indexOf(msg.properties.correlationId);
      global.msgQueue.splice(index, 1);
      global.resolveRabbit[msg.properties.correlationId].resolve({
        finalRes: JSON.parse(msg.content.toString())
      });
      delete global.resolveRabbit[msg.properties.correlationId];
    } else {
      if (global.resolveRabbit[msg.properties.correlationId]) {
        global.resolveRabbit[msg.properties.correlationId].reject({
          err: 'Unexpected message'
        });
        delete global.resolveRabbit[msg.properties.correlationId];
      } else {
        console.log('未找到对应的MQ');
      }
    }
  }

  send(content, type) {
    console.log(' [x] Requesting is ', content);
    let queue = config.MQ_QUEUE_ORDER;
    switch (type) {
      case 'account':
        queue = config.MQ_QUEUE_ACCOUNT;
        break;
      default:
        queue = config.MQ_QUEUE_ORDER;
        break;
    }
    return new Promise(async (resolve, reject) => {
      const correlationId = uuid();
      console.log('========= mq loading ==========');
      global.msgQueue.push(correlationId);
      global.resolveRabbit[correlationId] = {
        resolve: resolve,
        reject: reject
      };
      if (!global.readyListener.includes(queue)) {
        global.readyListener.push(queue);
        const _c = await Cache.getCache(`${packages.name}-mq`);
        console.log(_c);
        if (_c && _c.rabbitmq_queues && _c.rabbitmq_queues.queues) {
          const queues = _c.rabbitmq_queues.queues;
          if (queues.includes(`${queue}-${this.pid}`)) {
            console.log(`========= use old mq queue ${queue}-${this.pid} ==========`);
            this.ch.consume(`${queue}-${this.pid}`, (msg) => {
              this.mabeAnswer(msg);
            }, { noAck: true });
          } else {
            queues.push(`${queue}-${this.pid}`);
            console.log(`========= use new mq queue ${queue}-${this.pid} ==========`);
            Cache.setCache(`${packages.name}-mq`, {
              rabbitmq_queues: {
                queues
              },
            });
            this.ch.assertQueue(`${queue}-${this.pid}`, {durable: false}, (err, ok) => {
              if (err) return;
              this.ch.consume(`${queue}-${this.pid}`, (msg) => {
                this.mabeAnswer(msg);
              }, { noAck: true });
            });
          }
        } else {
          console.log('========== 初始化mq队列 ==========');
          Cache.setCache(`${packages.name}-mq`, {
            rabbitmq_queues: {
              queues: [`${queue}-${this.pid}`]
            },
          });
          this.ch.assertQueue(`${queue}-${this.pid}`, {durable: false}, (err, ok) => {
            if (err) return;
            this.ch.consume(`${queue}-${this.pid}`, (msg) => {
              this.mabeAnswer(msg);
            }, { noAck: true });
          });
        }
      }
      console.log(`============= use queue ${queue}-${this.pid}  ==============`);
      this.ch.sendToQueue(queue, new Buffer(JSON.stringify(content)), {
        replyTo: `${queue}-${this.pid}`,
        correlationId: correlationId
      })
    }).catch((err) => {
      console.log(err);
    });
  }

}

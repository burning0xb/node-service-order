import Redis from 'ioredis';
import autobind from 'autobind-decorator'
import packages from '../package.json';
import { host, port, password } from '../configs/redis.json';

@autobind
class RedisCache {
  constructor() {
    this.redis = new Redis({
      port, host, family: 4, password
    });
  }

  async getCache(key) {
    let data = await this.redis.get(key);
    return JSON.parse(data);
  }

  async setCache(key, value) {
    await this.redis.set(key, JSON.stringify(value));
  }

  async destroy(key) {
    return await this.redis.del(key);
  }

  static getInstance() {
    if(!this.instance) {
      this.instance = new RedisCache();
    }
    return this.instance;
  }

}

const Cache = RedisCache.getInstance();

export default Cache;

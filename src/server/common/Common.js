import { AttentionUser } from '../../model';
import dbStorage from '../../config/dbStorage';
import moment from 'moment';
import autobind from 'autobind-decorator'
import { logger } from '../../log4j';

@autobind
export default class Common {
  constructor() {
  }

  /**
   * [getUserList 获取用户信息]
   * @param  {Function} cb   [description]
   * @param  {[type]}   info [description]
   * @return {Promise}       [description]
   */
  async getOrderList(cb, info, mq) {
    logger.warn(`this is moment format ${moment().format('YYYY-MM-DD hh:mm:ss')}`);
    const content = {
      class: 'address',
      func: 'getUserAddress',
      content: {}
    };
    const address = await mq().send(content, 'account');
    cb({ code: '00000', order: [{
      orderId: Date.now(),
      price: 200
    }], address });
  }

}

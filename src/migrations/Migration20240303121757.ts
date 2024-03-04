import { Migration } from '@mikro-orm/migrations';

export class Migration20240303121757 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `metering-snapshots` (`timestamp` datetime not null, `consPeak` float not null, `consOffPeak` float not null, `injPeak` float not null, `injOffPeak` float not null, `batCharge` float not null, `batDischarge` float not null, `gas` float not null, primary key (`timestamp`)) default character set utf8mb4 engine = InnoDB;');
  }

}

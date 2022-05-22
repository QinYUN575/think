import { CollectorEntity } from '@entities/collector.entity';
import { CommentEntity } from '@entities/comment.entity';
import { DocumentEntity } from '@entities/document.entity';
import { DocumentAuthorityEntity } from '@entities/document-authority.entity';
import { MessageEntity } from '@entities/message.entity';
import { TemplateEntity } from '@entities/template.entity';
import { UserEntity } from '@entities/user.entity';
import { ViewEntity } from '@entities/view.entity';
import { WikiEntity } from '@entities/wiki.entity';
import { WikiUserEntity } from '@entities/wiki-user.entity';
import { IS_PRODUCTION } from '@helpers/env.helper';
import { getLogFileName, ONE_DAY } from '@helpers/log.helper';
import { CollectorModule } from '@modules/collector.module';
import { CommentModule } from '@modules/comment.module';
import { DocumentModule } from '@modules/document.module';
import { FileModule } from '@modules/file.module';
import { MessageModule } from '@modules/message.module';
import { TemplateModule } from '@modules/template.module';
import { UserModule } from '@modules/user.module';
import { ViewModule } from '@modules/view.module';
import { WikiModule } from '@modules/wiki.module';
import { forwardRef, Inject, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Cron, ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { getConfig } from '@think/config';
import * as fs from 'fs-extra';
import { LoggerModule } from 'nestjs-pino';
import * as path from 'path';
import pino from 'pino';

const ENTITIES = [
  UserEntity,
  WikiEntity,
  WikiUserEntity,
  DocumentAuthorityEntity,
  DocumentEntity,
  CollectorEntity,
  CommentEntity,
  MessageEntity,
  TemplateEntity,
  ViewEntity,
];

const MODULES = [
  UserModule,
  WikiModule,
  DocumentModule,
  CollectorModule,
  FileModule,
  CommentModule,
  MessageModule,
  TemplateModule,
  ViewModule,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      load: [getConfig],
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    IS_PRODUCTION &&
      LoggerModule.forRoot({
        pinoHttp: {
          stream: pino.destination({
            dest: `./logs/${getLogFileName(new Date())}`,
            minLength: 4096,
            mkdir: true,
            sync: false,
          }),
        },
      }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          type: 'mysql',
          entities: ENTITIES,
          keepConnectionAlive: true,
          ...config.get('db.mysql'),
        } as TypeOrmModuleOptions;
      },
    }),
    ...MODULES,
  ].filter(Boolean),
  controllers: [],
  providers: [],
})
export class AppModule {
  constructor(
    @Inject(forwardRef(() => ConfigService))
    private readonly configService: ConfigService
  ) {}

  /**
   * 每天早上9点，清理日志
   */
  @Cron('0 0 9 * * *')
  deleteLog() {
    let retainDays = this.configService.get('server.logRetainDays');
    const startDate = new Date(new Date().valueOf() - retainDays * ONE_DAY).valueOf();

    do {
      const filepath = path.join(__dirname, '../logs', getLogFileName(startDate, retainDays));
      fs.removeSync(filepath);
      retainDays -= 1;
    } while (retainDays > 0);
  }
}

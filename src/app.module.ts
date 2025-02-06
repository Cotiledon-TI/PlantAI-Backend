import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CarroComprasModule } from './carro-compras/carro-compras.module';
import { GlobalMiddleware } from './commons/middleware/global.middleware';
import { EquipoModule } from './commons/modelse3/equipo/equipo.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { ProductosModule } from './productos/productos.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { IaconsultasModule } from './iaconsultas/iaconsultas.module';
import { PromocionesModule } from './promociones/promociones.module';
import { PromocionesProductosModule } from './promociones/promociones.productos.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        process.env.AMBIENTE != undefined
          ? `.env.${process.env.AMBIENTE}`
          : `.env.dev`,
        `.env.ia`,
      ],
    }),

    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      logging: false, //depuracion
    }),
    ServeStaticModule.forRoot({
      rootPath: `${process.env.RUTA_FISICA}` || `./imagenes/productos`,
      serveRoot: `${process.env.RUTA_ESTATICOS}` || `/estaticos/`,
    }),
    ProductosModule,
    CarroComprasModule,
    PedidosModule,
    UsuariosModule,
    EquipoModule,
    AuthModule,
    IaconsultasModule,
    ReviewsModule,
    PromocionesModule,
    PromocionesProductosModule,
    CacheModule.register({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(GlobalMiddleware).forRoutes('*');
  }
}

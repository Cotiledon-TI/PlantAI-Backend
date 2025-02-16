import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductosController } from './controller/productos.controller';
import { Accesorio } from './entities/accesorios/accesorio.entity';
import { Categoria } from './entities/categoria.entity';
import { Insumo } from './entities/insumos/insumo.entity';
import { Macetero } from './entities/maceteros/macetero.entity';
import { Planta } from './entities/plantas/planta.entity';
import { Producto } from './entities/producto.entity';
import { ProductosService } from './service/productos.service';

import { JwtService } from '@nestjs/jwt';
import { CarroProducto } from 'src/carro-compras/entities/carro_producto.entity';
import { ColorProducto } from 'src/commons/entities/color.entity';
import { Marca } from 'src/commons/entities/marca.entity';
import { ProductoPedido } from 'src/pedidos/entities/productos_pedido.entity';
import { PromocionesProductosModule } from 'src/promociones/promociones.productos.module';
import { CatalogoController } from './controller/catalogo.controller';
import { TipoAccesorio } from './entities/accesorios/tipo_accesorio.entity';
import { ImagenProducto } from './entities/imagenes.entity';
import { TipoInsumo } from './entities/insumos/tipo_insumo.entity';
import { TipoMacetero } from './entities/maceteros/tipo_macetero.entity';
import { Entorno } from './entities/plantas/entorno.entity';
import { Fotoperiodo } from './entities/plantas/fotoperiodo.entity';
import { HabitoCrecimiento } from './entities/plantas/habito_crecimiento.entity';
import { Iluminacion } from './entities/plantas/iluminacion.entity';
import { Tamano } from './entities/plantas/tamano.entity';
import { TipoRiego } from './entities/plantas/tipo_riego.entity';
import { ToleranciaTemperatura } from './entities/plantas/tolerancia_temperatura.entity';
import { CatalogoService } from './service/catalogo.service';
import { ImageService } from './service/imagen.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Producto,
      Categoria,
      Marca,
      ColorProducto,
      Macetero,
      TipoMacetero,
      Insumo,
      TipoInsumo,
      Planta,
      Fotoperiodo,
      HabitoCrecimiento,
      TipoRiego,
      ToleranciaTemperatura,
      Tamano,
      Entorno,
      Iluminacion,
      Accesorio,
      TipoAccesorio,
      CarroProducto,
      ImagenProducto,
      ProductoPedido,
    ]),
    PromocionesProductosModule,
  ],
  controllers: [ProductosController, CatalogoController],
  providers: [ProductosService, ImageService, JwtService, CatalogoService],
  exports: [ProductosService],
})
export class ProductosModule {}

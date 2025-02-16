import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/jwt-auth.guard/roles.guard';
import { ProductoExistentePipe } from 'src/carro-compras/pipe/validar-producto-existente.pipe';
import { CreateProductoDto } from '../dto/producto/create-producto.dto';
import { GetProductosPaginadosDto } from '../dto/producto/get-productos-paginados-dto';
import { GetProductoDto } from '../dto/producto/get-producto.dto';
import { UpdateProductImageDto } from '../dto/producto/update-product-image.dto';
import { UpdateProductoDto } from '../dto/producto/update-producto.dto';
import { ValidarBase64Pipe } from '../pipe/validar-base64.pipe';
import { ValidarCategoriaProductoPipe } from '../pipe/validar-categoria-producto.pipe';
import { ValidarImagenProductoExistePipe } from '../pipe/validar-imagen-producto-existe.pipe';
import { ValidarPropiedadesProductoPipe } from '../pipe/validar-propiedades-producto.pipe';
import { ProductosService } from '../service/productos.service';

/**Historia de Usuario 5: Implementación de "gestión de productos" Administrador */
/**Historia de Usuario 7: Búsqueda de Productos */
@ApiTags('Gestión de productos')
@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  // Obtener todos, sin paginación
  @ApiOperation({
    summary:
      'Retorna todos los productos registrados. PREFERIR GET productos/admin para paginación.',
    description:
      'Ahora está habilitado el GET productos/admin, que retorna todos los productos y permite paginar.',
    deprecated: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna todos los productos',
    type: [GetProductoDto],
  })
  @ApiBearerAuth('access-token')
  @Get()
  @Roles('Super Admin', 'Admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findAll(): Promise<GetProductoDto[]> {
    return await this.productosService.getAll();
  }

  // Obtener todos, paginados
  @ApiOperation({
    summary: 'Retorna todos los productos registrados paginados.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Número de página' })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Cantidad de elementos por página',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna todos los productos',
    type: GetProductosPaginadosDto,
  })
  @ApiBearerAuth('access-token')
  @Get('admin')
  @Roles('Super Admin', 'Admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findAllPaginated(
    @Query('page')
    page?: number,
    @Query('pageSize')
    pageSize?: number,
  ): Promise<GetProductosPaginadosDto> {
    return await this.productosService.findAllPaginated({ page, pageSize });
  }

  // Obtener producto por id
  @ApiOperation({ summary: 'Busca un producto por su id' })
  @ApiResponse({
    status: 200,
    description: 'Retorna el producto que coincida con el id.',
    type: GetProductoDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No se encuentra un producto registrado con ese id',
  })
  @ApiParam({ name: 'id', type: Number })
  @Get(':id')
  async getById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GetProductoDto> {
    return await this.productosService.getById(+id);
  }

  // Crear un producto
  @ApiOperation({
    summary: 'Crea un producto.',
    description: 'Crea un producto nuevo. Permite agregar una imagen nueva.',
  })
  @ApiResponse({
    status: 200,
    description: 'Agrega un producto al sistema.',
    type: GetProductoDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No ha sido posible crear el producto',
  })
  @ApiBody({ type: CreateProductoDto })
  @ApiBearerAuth('access-token')
  @Post()
  @Roles('Super Admin', 'Admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createProduct(
    @Body(
      ValidarBase64Pipe,
      ValidarCategoriaProductoPipe,
      ValidarPropiedadesProductoPipe,
    )
    createProductoDto: CreateProductoDto,
  ): Promise<GetProductoDto> {
    return await this.productosService.create(createProductoDto);
  }

  // Actualizar un producto
  @ApiOperation({ summary: 'Actualiza un producto.' })
  @ApiBody({ type: UpdateProductoDto })
  @ApiResponse({
    status: 200,
    description: 'Actualiza un producto.',
    type: GetProductoDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No se ha encontrado un producto con ese id.',
  })
  @ApiParam({ name: 'idProducto', type: Number })
  @ApiBearerAuth('access-token')
  @Patch(':idProducto')
  @Roles('Super Admin', 'Admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateProduct(
    @Param('idProducto', ProductoExistentePipe) idProducto: number,
    @Body(
      ValidarBase64Pipe,
      ValidarCategoriaProductoPipe,
      ValidarPropiedadesProductoPipe,
    )
    updateProductoDto: UpdateProductoDto,
  ): Promise<GetProductoDto> {
    return await this.productosService.update(idProducto, updateProductoDto);
  }

  // Eliminar un producto
  @ApiOperation({
    summary: 'Elimina un producto según su id',
    description:
      'Ejecuta dos métodos de eliminación: \n' +
      '\n - Si el producto nunca ha sido comprado, se elimina completamente.\n' +
      '\n - Si el producto ya ha sido comprado, se ejecuta un Soft Delete (se invisibiliza toda su información, pero se conservan las asociaciones con el historial de pedidos).',
  })
  @ApiResponse({
    status: 204,
    description: 'Producto eliminado. Respuesta sin contenido',
  })
  @ApiResponse({
    status: 404,
    description: 'No existe un producto con ese id',
  })
  @ApiBearerAuth('access-token')
  @Delete(':idProducto')
  @Roles('Super Admin', 'Admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(204)
  async deleteOne(
    @Param('idProducto', ProductoExistentePipe) idProducto: number,
  ): Promise<void> {
    await this.productosService.deleteOne(idProducto);
    return;
  }

  // Subir imagen en bas64 a un producto
  @ApiOperation({
    summary:
      'Sube la imagen de un producto, guarda la ruta de acceso en el producto y retorna la ruta',
  })
  @ApiResponse({ status: 201, description: 'Imagen subida con éxito' })
  @ApiResponse({ status: 400, description: 'Error al subir imagen' })
  @ApiBody({ type: Object })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateProductImageDto })
  @Post('addProductImage/:idProducto')
  @Roles('Super Admin', 'Admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async addProductImage(
    @Body(ValidarBase64Pipe) base64Content: UpdateProductImageDto,
    @Param('idProducto', ParseIntPipe, ProductoExistentePipe)
    idProducto: number,
  ) {
    return await this.productosService.addProductImage(
      base64Content,
      idProducto,
    );
  }

  // @ApiOperation({
  //   summary:
  //     'INHABILITADO. Actualizar la imagen de un producto, guarda la ruta de acceso en el producto y retorna la ruta',
  // })
  // @ApiResponse({ status: 200, description: 'Imagen actualizada con éxito' })
  // @ApiResponse({ status: 400, description: 'Error al actualizar imagen' })
  // @ApiBody({ type: UpdateProductImageDto })
  // @ApiBearerAuth()
  // @Roles('Super Admin', 'Admin')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Patch('updateProductImage/:idProducto')
  // async updateProductImage(
  //   @Body(ValidarBase64Pipe) base64Content: UpdateProductImageDto,
  //   @Param('idProducto', ParseIntPipe, ProductoExistentePipe)
  //   idProducto: number,
  // ) {
  //   throw new ServiceUnavailableException('Servicio en mantención')
  //   // return await this.productosService.updateProductImage(
  //   //   base64Content,
  //   //   idProducto,
  //   // );
  // }

  // Eliminar imagen
  @ApiOperation({
    summary:
      'Eliminar la imagen de un producto según el índice de la imagen en el arreglo.',
  })
  @ApiResponse({
    status: 204,
    description: 'Imagen eliminada con éxito. Respuesta sin contenido',
  })
  @ApiResponse({ status: 400, description: 'Error al eliminar imagen' })
  @ApiBearerAuth('access-token')
  @Delete('deleteProductImage/:idProducto/:indiceImagen')
  @Roles('Super Admin', 'Admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(204)
  async deleteProductImage(
    @Param(
      'idProducto',
      ParseIntPipe,
      ProductoExistentePipe,
      ValidarImagenProductoExistePipe,
    )
    idProducto: number,
    @Param('indiceImagen', ParseIntPipe)
    indiceImagen: number,
  ): Promise<void> {
    return await this.productosService.deleteProductImage(
      idProducto,
      indiceImagen,
    );
  }
}

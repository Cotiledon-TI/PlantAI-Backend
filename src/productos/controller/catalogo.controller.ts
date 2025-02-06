import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  FiltrosCatalogoDto,
  SearchCatalogoDto,
} from '../dto/catalogo/paginacion.dto';
import { GetProductosPaginadosDto } from '../dto/producto/get-productos-paginados-dto';
import { CatalogoService } from '../service/catalogo.service';

/**Historia de Usuario 12: Visualización del catálogo*/
@ApiTags('Catálogo')
@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  // Obtener todos los productos
  @ApiOperation({
    summary: 'Obtener todos los productos del catálogo, permite usar filtros',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna todos los productos del catálogo',
    type: GetProductosPaginadosDto,
  })
  @ApiQuery({ name: 'page', required: false, description: 'Número de página' })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Cantidad de elementos por página',
  })
  @Get()
  async findAll(
    @Query() filtrosCatalogoDto: FiltrosCatalogoDto,
  ): Promise<GetProductosPaginadosDto> {
    return await this.catalogoService.findAll(filtrosCatalogoDto);
  }

  // Obtener catalogo por search
  @ApiOperation({
    summary: 'Obtener productos del catálogo según búsqueda por texto',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna los productos del catálogo por búsqueda',
    type: GetProductosPaginadosDto,
  })
  @Get('search')
  async findBySearch(
    @Query() searchCatalogoDto: SearchCatalogoDto,
  ): Promise<GetProductosPaginadosDto> {
    return await this.catalogoService.findBySearch(searchCatalogoDto);
  }
}

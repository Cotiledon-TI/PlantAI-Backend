import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { createHash } from 'crypto';
import { PromocionesProductosService } from 'src/promociones/service/promociones-productos.service';
import { Repository } from 'typeorm';
import {
  FiltrosCatalogoDto,
  SearchCatalogoDto,
} from '../dto/catalogo/paginacion.dto';
import { GetProductosPaginadosDto } from '../dto/producto/get-productos-paginados-dto';
import { Producto } from '../entities/producto.entity';
import { ProductoMapper } from '../mapper/entity-to-dto-producto';

@Injectable()
export class CatalogoService {
  private readonly cacheTTL: number = 1000 * 60 * 10;
  constructor(
    @InjectRepository(Producto)
    private readonly productoRepository: Repository<Producto>,
    @Inject(PromocionesProductosService)
    private readonly promocionesProductosService: PromocionesProductosService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**Retorna todos los productos */
  async findAll(
    filtrosCatalogoDto: FiltrosCatalogoDto,
  ): Promise<GetProductosPaginadosDto> {
    // Revisar: Debería poder continuar aunque la búsqueda en caché tire un error
    try {
      const catalogoCache: GetProductosPaginadosDto =
        await this.findCatalogCache(filtrosCatalogoDto);
      if (catalogoCache) {
        return catalogoCache;
      }
      const {
        page,
        pageSize,
        idEntorno,
        petFriendly,
        idIluminacion,
        idTipoRiego,
        idToleranciaTemperatura,
        maxPrecio,
        minPrecio,
        ordenarPor,
        puntuacion,
        orden,
        sizePlant,
      } = filtrosCatalogoDto;
      const limit = pageSize;
      const offset = (page - 1) * limit;
      const queryBuilder = this.productoRepository
        .createQueryBuilder('producto')
        .innerJoinAndSelect('producto.categoria', 'categoria')
        .leftJoinAndSelect('producto.planta', 'planta')
        .leftJoinAndSelect('planta.entorno', 'entorno')
        .leftJoinAndSelect('producto.imagenes', 'imagenes')
        .leftJoinAndSelect('planta.iluminacion', 'iluminacion')
        .leftJoinAndSelect('planta.tipoRiego', 'tipoRiego')
        .leftJoinAndSelect(
          'planta.toleranciaTemperatura',
          'toleranciaTemperatura',
        )
        .leftJoinAndSelect('planta.color', 'color')
        .leftJoinAndSelect('planta.fotoPeriodo', 'fotoPeriodo')
        .leftJoinAndSelect('planta.habitoCrecimiento', 'habitoCrecimiento')
        .leftJoinAndSelect('planta.tamano', 'tamano')
        .where('producto.habilitado = :habilitado', { habilitado: true })
        .andWhere('producto.idCategoria = :idCategoria', { idCategoria: 1 });

      if (idEntorno) {
        queryBuilder.andWhere('planta.idEntorno = :idEntorno', {
          idEntorno,
        });
      }
      if (petFriendly) {
        queryBuilder.andWhere('planta.petFriendly = :petFriendly', {
          petFriendly,
        });
      }
      if (idIluminacion) {
        queryBuilder.andWhere('planta.idIluminacion = :idIluminacion', {
          idIluminacion,
        });
      }
      if (idTipoRiego) {
        queryBuilder.andWhere('planta.idTipoRiego = :idTipoRiego', {
          idTipoRiego,
        });
      }
      if (idToleranciaTemperatura) {
        queryBuilder.andWhere(
          'planta.idToleranciaTemperatura = :idToleranciaTemperatura',
          { idToleranciaTemperatura },
        );
      }
      if (maxPrecio) {
        queryBuilder.andWhere('producto.precio <= :maxPrecio', { maxPrecio });
      }
      if (minPrecio) {
        queryBuilder.andWhere('producto.precio >= :minPrecio', { minPrecio });
      }
      if (puntuacion) {
        queryBuilder.andWhere('producto.puntuacion >= :puntuacion', {
          puntuacion,
        });
      }
      if (sizePlant) {
        queryBuilder.andWhere('planta.tamano = :sizePlant', { sizePlant });
      }

      if (ordenarPor) {
        queryBuilder.orderBy(`producto.${ordenarPor}`, orden || 'ASC');
      }

      queryBuilder.skip(offset).take(limit);

      const [result, totalItems] = await queryBuilder.getManyAndCount();
      // Asignar promociones a cada producto
      await Promise.all(
        result.map(async (producto: Producto) => {
          producto.promociones =
            await this.promocionesProductosService.findActivesByProductId(
              producto.id,
            );
          producto.promociones =
            this.promocionesProductosService.filtrarPromocionesDestacadas(
              producto.promociones,
              producto.precio,
            );
        }),
      );
      const catalogoDto: GetProductosPaginadosDto = {
        data: ProductoMapper.entitiesToDtos(result),
        totalItems,
      };
      const catalogHash: string = this.generateCatalogHash(filtrosCatalogoDto);
      // Guardar el catálogo filtrado en caché
      await this.cacheManager.set(catalogHash, catalogoDto, this.cacheTTL);
      return catalogoDto;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // retorna producto por busqueda

  async findBySearch(
    searchCatalogoDto: SearchCatalogoDto,
  ): Promise<GetProductosPaginadosDto> {
    try {
      const { page, pageSize, search } = searchCatalogoDto;
      const limit = pageSize;
      const offset = (page - 1) * limit;
      const queryBuilder = this.productoRepository
        .createQueryBuilder('producto')
        .innerJoinAndSelect('producto.categoria', 'categoria')
        .leftJoinAndSelect('producto.planta', 'planta')
        .leftJoinAndSelect('planta.entorno', 'entorno')
        .leftJoinAndSelect('producto.imagenes', 'imagenes')
        .leftJoinAndSelect('planta.iluminacion', 'iluminacion')
        .leftJoinAndSelect('planta.tipoRiego', 'tipoRiego')
        .leftJoinAndSelect(
          'planta.toleranciaTemperatura',
          'toleranciaTemperatura',
        )
        .leftJoinAndSelect('planta.color', 'color')
        .leftJoinAndSelect('planta.fotoPeriodo', 'fotoPeriodo')
        .leftJoinAndSelect('planta.habitoCrecimiento', 'habitoCrecimiento')
        .leftJoinAndSelect('planta.tamano', 'tamano')
        .where('producto.habilitado = :habilitado', { habilitado: true })
        .andWhere('producto.idCategoria = :idCategoria', { idCategoria: 1 })
        .andWhere('producto.nombre LIKE :search', { search: `%${search}%` });

      queryBuilder.skip(offset).take(limit);

      const [result, totalItems] = await queryBuilder.getManyAndCount();
      // Asignar promociones a cada producto
      await Promise.all(
        result.map(async (producto: Producto) => {
          producto.promociones =
            await this.promocionesProductosService.findActivesByProductId(
              producto.id,
            );
        }),
      );

      return { data: ProductoMapper.entitiesToDtos(result), totalItems };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**Retorna el registro de catálogo en cache asociado a los filtros aplicados */
  private async findCatalogCache(
    filtrosCatalogoDto: FiltrosCatalogoDto,
  ): Promise<GetProductosPaginadosDto> {
    try {
      const catalogHash: string = this.generateCatalogHash(filtrosCatalogoDto);
      const catalogoCache: GetProductosPaginadosDto =
        await this.cacheManager.get(catalogHash);
      if (catalogoCache) {
        const { maxPrecio, minPrecio } = filtrosCatalogoDto;
        if (maxPrecio) {
          catalogoCache.data = catalogoCache.data.filter(
            (producto) => producto.precio <= maxPrecio,
          );
        }
        if (minPrecio) {
          catalogoCache.data = catalogoCache.data.filter(
            (producto) => producto.precio >= minPrecio,
          );
        }
        return catalogoCache;
      }
      return null;
    } catch (error) {
      throw new BadRequestException('Error al obtener datos del catálogo');
    }
  }

  /**Genera un hash para un conjunto de filtros específicos */
  private generateCatalogHash(filtrosCatalogoDto: FiltrosCatalogoDto): string {
    // No se incluye el filtro por precios
    const {
      page,
      pageSize,
      idEntorno,
      petFriendly,
      idIluminacion,
      idTipoRiego,
      idToleranciaTemperatura,
      ordenarPor,
      puntuacion,
      orden,
      sizePlant,
    } = filtrosCatalogoDto;

    return createHash('sha256')
      .update(
        JSON.stringify({
          page,
          pageSize,
          idEntorno,
          petFriendly,
          idIluminacion,
          idTipoRiego,
          idToleranciaTemperatura,
          ordenarPor,
          puntuacion,
          orden,
          sizePlant,
        }),
      )
      .digest('hex');
  }
}

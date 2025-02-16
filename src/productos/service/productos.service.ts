import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CarroProducto } from 'src/carro-compras/entities/carro_producto.entity';
import { ProductoPedido } from 'src/pedidos/entities/productos_pedido.entity';
import { PromocionesProductosService } from 'src/promociones/service/promociones-productos.service';
import { DeepPartial, Repository } from 'typeorm';
import { PaginacionDto } from '../dto/catalogo/paginacion.dto';
import { CreateProductoDto } from '../dto/producto/create-producto.dto';
import { GetProductoDto } from '../dto/producto/get-producto.dto';
import { GetProductosPaginadosDto } from '../dto/producto/get-productos-paginados-dto';
import { UpdateProductImageDto } from '../dto/producto/update-product-image.dto';
import { UpdateProductoDto } from '../dto/producto/update-producto.dto';
import { Accesorio } from '../entities/accesorios/accesorio.entity';
import { ImagenProducto } from '../entities/imagenes.entity';
import { Insumo } from '../entities/insumos/insumo.entity';
import { Macetero } from '../entities/maceteros/macetero.entity';
import { Planta } from '../entities/plantas/planta.entity';
import { Producto } from '../entities/producto.entity';
import { ProductoMapper } from '../mapper/entity-to-dto-producto';
import { PRODUCTO_RELATIONS } from '../shared/constants/producto-relaciones';
import { ImageService } from './imagen.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class ProductosService {
  /**Prefijo para identificar los productos guardados en caché. Se guardan con "prefijo + id". Ej: "producto-1" */
  private readonly cacheProductPrefix: string = 'producto-';
  /**"Time To Live" - Tiempo de permanencia de cada elemento en la memoria caché, en milisegundos */
  private readonly cacheTTL: number = 1000 * 60 * 60 * 24;
  constructor(
    @InjectRepository(Producto)
    readonly productoRepository: Repository<Producto>,
    @InjectRepository(ImagenProducto)
    private readonly imagenProductoRepository: Repository<ImagenProducto>,
    @InjectRepository(ProductoPedido)
    private readonly productoPedidoRepository: Repository<ProductoPedido>,
    @Inject(PromocionesProductosService)
    private readonly promocionesProductosService: PromocionesProductosService,
    private readonly imageService: ImageService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * BÚSQUEDA
   */

  /**Retorna el producto cuyo id coincida con el ingresado.*/
  async getById(id: number): Promise<GetProductoDto> {
    const productoCache: GetProductoDto = await this.cacheManager.get(
      `${this.cacheProductPrefix}${id}`,
    );
    if (!productoCache) {
      const producto = await this.getEntityById(id, PRODUCTO_RELATIONS);
      if (!producto) {
        throw new NotFoundException('No existe un producto con ese id.');
      }
      // Obtener promociones destacadas
      producto.promociones =
        await this.promocionesProductosService.findActivesByProductId(
          producto.id,
        );
      producto.promociones =
        this.promocionesProductosService.filtrarPromocionesDestacadas(
          producto.promociones,
          producto.precio,
        );
      const productoDto: GetProductoDto = ProductoMapper.entityToDto(producto);
      await this.cacheManager.set(
        `${this.cacheProductPrefix}${id}`,
        productoDto,
        this.cacheTTL,
      );
      return ProductoMapper.entityToDto(producto);
    }
    return productoCache;
  }

  /**Retorna todos los productos registrados, con paginación. Para endpoints de Gestión de Productos (Admins) */
  async findAllPaginated(
    paginationDto: PaginacionDto,
  ): Promise<GetProductosPaginadosDto> {
    try {
      const pagination: PaginacionDto = {
        page: paginationDto.page ? +paginationDto.page : 1,
        pageSize: paginationDto.pageSize ? +paginationDto.pageSize : 10,
      };
      const [result, totalItems] = await this.productoRepository.findAndCount({
        take: pagination.pageSize,
        skip: (pagination.page - 1) * pagination.pageSize,
        relations: PRODUCTO_RELATIONS,
      });

      return {
        totalItems,
        data: ProductoMapper.entitiesToDtos(result),
      };
    } catch (error) {
      throw new BadRequestException('Error al obtener productos', {
        description: error.message,
      });
    }
  }

  /**Retorna todos los productos registrados.*/
  async getAll(): Promise<GetProductoDto[]> {
    try {
      const productos = await this.productoRepository.find({
        relations: PRODUCTO_RELATIONS,
      });
      return ProductoMapper.entitiesToDtos(productos);
    } catch (error) {
      throw new BadRequestException('Error al obtener productos', {
        description: error.message,
      });
    }
  }

  /**Retorna una entidad Producto por id. Método auxiliar. */
  private async getEntityById(
    idProducto: number,
    relaciones: string[],
  ): Promise<Producto> {
    try {
      const producto = await this.productoRepository.findOne({
        where: { id: idProducto },
        relations: relaciones,
      });
      return producto;
    } catch (error) {
      throw new BadRequestException('Error al obtener producto', {
        description: error.message,
      });
    }
  }

  /**
   * CREACIÓN
   */

  /**Crea un producto nuevo. */
  async create(createProductoDto: CreateProductoDto): Promise<GetProductoDto> {
    try {
      const nuevoProducto = await this.productoRepository.manager.transaction(
        async (transactionalEM) => {
          const producto: Producto = Object.assign(
            new Producto(),
            createProductoDto,
          );
          const productoGuardado = await transactionalEM.save(producto);

          const productoId = productoGuardado.id;
          if (createProductoDto.planta) {
            const planta: Planta = Object.assign(
              new Planta(),
              createProductoDto.planta,
            );
            planta.idProducto = productoId;
            productoGuardado.planta = await transactionalEM.save(planta);
          }
          if (createProductoDto.macetero) {
            const macetero: Macetero = Object.assign(
              new Macetero(),
              createProductoDto.macetero,
            );
            macetero.idProducto = productoId;
            productoGuardado.macetero = await transactionalEM.save(macetero);
          }
          if (createProductoDto.insumo) {
            const insumo: Insumo = Object.assign(
              new Insumo(),
              createProductoDto.insumo,
            );
            insumo.idProducto = productoId;
            productoGuardado.insumo = await transactionalEM.save(insumo);
          }
          if (createProductoDto.accesorio) {
            const accesorio: Accesorio = Object.assign(
              new Accesorio(),
              createProductoDto.accesorio,
            );
            accesorio.idProducto = productoId;
            productoGuardado.accesorio = await transactionalEM.save(accesorio);
          }
          if (createProductoDto.imagen) {
            const rutaImagen: string = await this.imageService.addImage(
              createProductoDto.imagen,
            );
            const nuevaImagen: ImagenProducto = new ImagenProducto(
              productoId,
              rutaImagen,
            );
            const imagenGuardada: ImagenProducto =
              await transactionalEM.save(nuevaImagen);
            productoGuardado.imagenes = [imagenGuardada];
          }
          return productoGuardado;
        },
      );
      return await this.getById(nuevoProducto.id);
    } catch (error) {
      throw new BadRequestException('Error al crear producto', {
        description: error.message,
      });
    }
  }

  /**
   * ACTUALIZACIÓN
   */

  /**Actualiza un producto segpun su id. */
  async update(
    id: number,
    updateProductoDto: UpdateProductoDto,
  ): Promise<GetProductoDto> {
    try {
      const updateProducto = await this.productoRepository.manager.transaction(
        async (transactionalEntityManager) => {
          const producto = await transactionalEntityManager.findOne(Producto, {
            where: { id: id },
            relations: PRODUCTO_RELATIONS,
          });
          transactionalEntityManager.merge(
            Producto,
            producto,
            updateProductoDto as DeepPartial<Producto>,
          );
          if (updateProductoDto.planta) {
            await transactionalEntityManager.update(
              Planta,
              producto.planta.idProducto,
              updateProductoDto.planta as Planta,
            );
          }
          if (updateProductoDto.macetero) {
            transactionalEntityManager.update(
              Macetero,
              producto.macetero.idProducto,
              updateProductoDto.macetero as Macetero,
            );
          }
          if (updateProductoDto.insumo) {
            transactionalEntityManager.update(
              Insumo,
              producto.insumo.idProducto,
              updateProductoDto.insumo as Insumo,
            );
          }
          if (updateProductoDto.accesorio) {
            transactionalEntityManager.update(
              Accesorio,
              producto.accesorio.idProducto,
              updateProductoDto.accesorio as Accesorio,
            );
          }
          return await transactionalEntityManager.save(producto);
        },
      );
      await this.cacheManager.del(`${this.cacheProductPrefix}${id}`);
      return await this.getById(updateProducto.id);
    } catch (error) {
      throw new BadRequestException('Error al actualizar producto', {
        description: error.message,
      });
    }
  }

  /**
   * ELIMINACIÓN
   */

  /**Elimina un producto según su id. */
  async deleteOne(idProducto: number): Promise<void> {
    try {
      const producto = await this.getEntityById(idProducto, PRODUCTO_RELATIONS);

      // Revisar si el producto ha sido comprado
      const productoComprado: boolean =
        await this.productoPedidoRepository.existsBy({
          idProducto: idProducto,
        });

      // Si fue comprado, se eliminan las imagenes y se hace un soft delete del producto
      if (productoComprado) {
        await this.productoRepository.manager.transaction(
          async (transactionalEntityManager) => {
            if (producto.imagenes) {
              if (producto.imagenes.length > 0) {
                await transactionalEntityManager.delete(
                  ImagenProducto,
                  producto.imagenes,
                );
              }
            }
            await transactionalEntityManager.softDelete(Producto, {
              id: producto.id,
            });
          },
        );
        if (producto.imagenes) {
          if (producto.imagenes.length > 0) {
            await Promise.all(
              producto.imagenes.map(async (imagen) => {
                const rutaImage = this.staticToFilesPath(imagen.ruta);
                await this.imageService.deleteImageFile(rutaImage);
              }),
            );
          }
        }
      }

      // Si no se ha comprado, se elimina el producto completo
      else {
        await this.productoRepository.manager.transaction(
          async (transactionalEntityManager) => {
            await transactionalEntityManager.delete(CarroProducto, {
              idProducto: idProducto,
            });
            await transactionalEntityManager.delete('productos_etiquetas', {
              id_producto: idProducto,
            });
            if (producto.planta) {
              await transactionalEntityManager.delete(
                Planta,
                producto.planta.idProducto,
              );
            }
            if (producto.macetero) {
              await transactionalEntityManager.delete(
                Macetero,
                producto.macetero.idProducto,
              );
            }
            if (producto.insumo) {
              await transactionalEntityManager.delete(
                Insumo,
                producto.insumo.idProducto,
              );
            }
            if (producto.accesorio) {
              await transactionalEntityManager.delete(
                Accesorio,
                producto.accesorio.idProducto,
              );
            }
            if (producto.imagenes) {
              if (producto.imagenes.length > 0) {
                await transactionalEntityManager.delete(
                  ImagenProducto,
                  producto.imagenes,
                );
              }
            }
            await transactionalEntityManager.delete(Producto, idProducto);
          },
        );
        if (producto.imagenes) {
          if (producto.imagenes.length > 0) {
            await Promise.all(
              producto.imagenes.map(async (imagen) => {
                const rutaImage = this.staticToFilesPath(imagen.ruta);
                await this.imageService.deleteImageFile(rutaImage);
              }),
            );
          }
        }
      }
      await this.cacheManager.del(`${this.cacheProductPrefix}${idProducto}`);
      return;
    } catch (error) {
      throw new BadRequestException('Error al eliminar producto', {
        description: error.message,
      });
    }
  }

  /**
   * MÉTODOS DE IMÁGENES
   */

  /**Subir una imagen en Base64; guardar ruta en DB y SV estáticos*/
  async addProductImage(
    base64Content: UpdateProductImageDto,
    idProducto: number,
  ): Promise<string> {
    try {
      const rutaImagen = await this.imageService.addImage(
        base64Content.base64Content,
      );
      const nuevaImagen: ImagenProducto = new ImagenProducto(
        idProducto,
        rutaImagen,
      );
      await this.imagenProductoRepository.save(nuevaImagen);
      await this.cacheManager.del(`${this.cacheProductPrefix}${idProducto}`);
      return rutaImagen;
    } catch (error) {
      throw new BadRequestException('Error al agregar la imagen', {
        description: error.message,
      });
    }
  }

  //********************************UPDATE*********************************** */
  /**Actualiza una imagen en Base64; guardar ruta en DB y SV estáticos*/
  // async updateProductImage(
  //   base64Content: UpdateProductImageDto,
  //   idProducto: number,
  // ) {
  //   try {
  //     const producto = await this.productoRepository.findOne({
  //       where: { id: idProducto },
  //       relations: PRODUCTO_RELATIONS,
  //     });

  //     //reemplaza la ruta de la db por la ruta de la carpeta física
  //     if (!producto.imagen) {
  //       return this.addProductImage(base64Content, idProducto);
  //     } else {
  //       const rutaArchivoActual = producto.imagen.replace(
  //         `${process.env.RUTA_ESTATICOS}`,
  //         `${process.env.RUTA_FISICA}/`,
  //       );
  //       //actualiza la imagen en la carpeta física
  //       const rutaImagen = await this.imageService.updateImage(
  //         base64Content.base64Content,
  //         rutaArchivoActual,
  //       );

  //       //actualiza la ruta de la imagen en la db
  //       await this.productoRepository.update(idProducto, {
  //         imagen: rutaImagen,
  //       });

  //       return rutaImagen;
  //     }
  //   } catch (error) {
  //     console.error(error);
  //     throw new BadRequestException('Error al actualizar imagen');
  //   }
  // }

  /**Elimina una imagen de un producto en Base64. Borra la imagen en la posición de índice del arreglo de imágenes, borra la ruta de DB y el archivo. */
  async deleteProductImage(
    idProducto: number,
    indiceImagen: number,
  ): Promise<void> {
    try {
      const producto = await this.getEntityById(idProducto, ['imagenes']);

      if (producto.imagenes.length < indiceImagen + 1 || indiceImagen < 0) {
        throw new BadRequestException('Índice inválido');
      }
      const imagenEliminada: ImagenProducto = producto.imagenes[indiceImagen];
      const rutaImage = this.staticToFilesPath(imagenEliminada.ruta);
      await this.imageService.deleteImageFile(rutaImage);
      await this.imagenProductoRepository.remove(imagenEliminada);
      await this.cacheManager.del(`${this.cacheProductPrefix}${idProducto}`);
    } catch (error) {
      throw new BadRequestException(
        'Error al eliminar la imagen',
        error.message,
      );
    }
    return;
  }

  /**Convierte un string de ruta estática a ruta física, de acuerdo a las variables respectivos de entorno. */
  private staticToFilesPath(ruta: string): string {
    const rutaImagen = ruta.replace(
      `${process.env.RUTA_ESTATICOS}`,
      `${process.env.RUTA_FISICA}/`,
    );
    return rutaImagen;
  }

  /**
   * AUXILIARES
   */
}

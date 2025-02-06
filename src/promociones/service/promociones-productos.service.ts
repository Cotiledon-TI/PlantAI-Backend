import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Promocion } from '../entities/promocion.entity';
import { PROMOCIONES_RELATIONS } from '../shared/constant/promociones.relations';
import { GetCuponValidadoDto } from '../dto/get_cupon_validado.dto';

/**Service encargado de obtener las promociones para cada producto. */
@Injectable()
export class PromocionesProductosService {
  constructor(
    @InjectRepository(Promocion)
    private readonly promocionesRepository: Repository<Promocion>,
  ) {}
  /**Retorna un arreglo de promociones vigentes para un producto. */
  async findActivesByProductId(idProduct: number): Promise<Promocion[]> {
    try {
      const dateNow: Date = new Date();
      const promociones: Promocion[] = await this.promocionesRepository.find({
        where: [
          {
            productos: {
              id: idProduct,
            },
            fechaInicio: LessThanOrEqual(dateNow),
            fechaTermino: MoreThanOrEqual(dateNow),
            habilitado: true,
          },
          {
            idTipoSeleccionProductos: 1,
            fechaInicio: LessThanOrEqual(dateNow),
            fechaTermino: MoreThanOrEqual(dateNow),
            habilitado: true,
          },
        ],
        relations: PROMOCIONES_RELATIONS,
      });
      return promociones;
    } catch (error) {
      throw new BadRequestException('Error al obtener promociones', {
        description: error.message,
      });
    }
  }

  /**Retorna un arreglo con todas las promociones tipo CUPON y la mejor promoción de tipo TRADICIONAL del producto.*/
  filtrarPromocionesDestacadas(
    promociones: Promocion[],
    precioProducto: number,
  ): Promocion[] {
    // Primero agregar todas las de tipo CUPON
    const destacadas: Promocion[] = promociones.filter(
      (promocion) => promocion.idTipoPromocion == 2,
    );
    // Filtrar promociones tradicionales según el mayor descuento o el precio menor
    const tradicionales: Promocion[] = promociones.filter(
      (promocion) => promocion.idTipoPromocion == 1,
    );
    if (tradicionales.length) {
      let mejorPromocion: Promocion = tradicionales[0];
      if (tradicionales.length > 1) {
        let precioFinal: number = precioProducto;
        promociones.forEach((promocion) => {
          // Si es porcentaje
          if (promocion.idTipoDescuento == 1) {
            const precioDescuento: number =
              (1 - promocion.valor / 100) * precioProducto;
            if (precioDescuento < precioFinal) {
              mejorPromocion = promocion;
              precioFinal = precioDescuento;
            }
          }
          // Si es precio fijo
          else if (promocion.idTipoDescuento == 2) {
            if (promocion.valor < precioFinal) {
              mejorPromocion = promocion;
              precioFinal = promocion.valor;
            }
          }
        });
      }
      destacadas.push(mejorPromocion);
    }
    return destacadas;
  }

  /**Filtra un conjunto de promociones para obtener la que haga el mayor descuento según un precio de producto.*/
  obtenerMejorPromocion(
    promociones: Promocion[],
    precioProducto: number,
    cuponesValidados?: GetCuponValidadoDto[],
  ): Promocion {
    if (promociones.length == 0) {
      return null;
    }
    const promocionesFiltradas: Promocion[] = this.filtrarPromocionesDestacadas(
      promociones,
      precioProducto,
    );
    // Obtener las promociones tradicionales y las de cupón que hayan sido validadas
    const promocionesValidas: Promocion[] = promocionesFiltradas.filter(
      (promocion) => {
        if (promocion.idTipoPromocion == 1) return promocion;
        if (promocion.idTipoPromocion == 2) {
          if (cuponesValidados) {
            if (
              cuponesValidados.findIndex(
                (cupon) => cupon.idCupon == promocion.id,
              ) >= 0
            )
              return promocion;
          }
        }
      },
    );
    let mejorPromocion: Promocion = promocionesValidas[0];
    let precioMenor: number = precioProducto;

    // Proceso para obtener la mejor promoción
    promocionesValidas.forEach((promocion) => {
      // Si es tipo porcentaje
      if (promocion.idTipoDescuento == 1) {
        // Para asegurar que no haya un descuento mayor al 100%
        if (promocion.valor <= 100) {
          const precioDescuento: number =
            (1 - promocion.valor / 100) * precioProducto;
          if (precioDescuento < precioMenor) {
            precioMenor = precioDescuento;
            mejorPromocion = promocion;
          }
        }
      }
      // Si es tipo precio fijo
      else if (promocion.idTipoDescuento == 2) {
        if (promocion.valor < precioMenor) {
          precioMenor = promocion.valor;
          mejorPromocion = promocion;
        }
      }
    });
    return mejorPromocion;
  }

  /**Retorna el precio final después de aplicar una promoción a un precio. */
  calcularPrecioFinal(precioProducto: number, promocion: Promocion): number {
    // Si es por porcentaje
    if (promocion.idTipoDescuento == 1) {
      return (1 - promocion.valor / 100) * precioProducto;
    }
    // Si es por precio fijo
    else if (promocion.idTipoDescuento == 2) return promocion.valor;
  }
}

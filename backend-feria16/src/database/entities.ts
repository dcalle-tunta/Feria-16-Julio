import { UsuarioBackoffice } from '../modules/auth/entities/usuario-backoffice.entity';
import { NegocioDiaAtencion } from '../modules/businesses/entities/negocio-dia-atencion.entity';
import { Negocio } from '../modules/businesses/entities/negocio.entity';
import { ConsultaNegocioSugerido } from '../modules/chat/entities/consulta-negocio-sugerido.entity';
import { Consulta } from '../modules/chat/entities/consulta.entity';
import { SesionUsuario } from '../modules/chat/entities/sesion-usuario.entity';
import { ProductoImagen } from '../modules/products/entities/producto-imagen.entity';
import { ProductoServicio } from '../modules/products/entities/producto-servicio.entity';
import { Categoria } from '../modules/system/entities/categoria.entity';
import { ConfiguracionSistema } from '../modules/system/entities/configuracion-sistema.entity';
import { DiaSemana } from '../modules/system/entities/dia-semana.entity';

export const entities = [
  UsuarioBackoffice,
  ConfiguracionSistema,
  Categoria,
  DiaSemana,
  Negocio,
  NegocioDiaAtencion,
  ProductoServicio,
  ProductoImagen,
  SesionUsuario,
  Consulta,
  ConsultaNegocioSugerido,
];

import { NomeModulo, TipoPlano } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

// The operational catalog is explicit: commercial placeholders are not sellable yet.
export const MODULOS_IMPLEMENTADOS: NomeModulo[] = [
  'CAIXA_PDV','FIADOS','VASILHAMES_RETORNAVEIS','ENTREGAS_DELIVERY',
  'ESTOQUE_LOTES','COMPRAS_FORNECEDORES','RELATORIOS_AVANCADOS',
];
export const MODULOS_PENDENTES: NomeModulo[] = [
  'PEDIDOS_ATACADO','TABELA_PRECO_VOLUME','ROTAS_CAMINHOES','CREDITO_B2B',
];
export const MODULOS_PADRAO: Record<TipoPlano, NomeModulo[]> = {
  VAREJO_BASICO: ['CAIXA_PDV','FIADOS'],
  VAREJO_PRO: [...MODULOS_IMPLEMENTADOS],
  ATACADO_FULL: [...MODULOS_IMPLEMENTADOS],
  PERSONALIZADO: [],
};
type EmpresaModulos = { plano: { modulosPadrao: NomeModulo[] } | null; modulosAtivos: { modulo: NomeModulo; ativo: boolean }[] };
export function resolverModulos(empresa: EmpresaModulos): Record<NomeModulo, boolean> {
  const disponiveis = new Set(MODULOS_IMPLEMENTADOS);
  const explicitos = new Map(empresa.modulosAtivos.map(m => [m.modulo,m.ativo]));
  return Object.fromEntries(Object.values(NomeModulo).map(modulo => [
    modulo, disponiveis.has(modulo) && (explicitos.get(modulo) ?? (empresa.plano ? empresa.plano.modulosPadrao.includes(modulo) : true)),
  ])) as Record<NomeModulo, boolean>;
}
export async function consultarModulos(prisma: PrismaService, empresaId: number) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { plano: { select: { modulosPadrao: true } }, modulosAtivos: { select: { modulo: true, ativo: true } } },
  });
  if (!empresa) throw new ForbiddenException('Empresa não identificada para validar os módulos.');
  return resolverModulos(empresa);
}

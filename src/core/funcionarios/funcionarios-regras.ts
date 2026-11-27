import { BadRequestException, ForbiddenException } from '@nestjs/common';

export const PERMISSOES_FUNCIONARIO = ['VENDAS_CANCELAR','CAIXA_MOVIMENTAR','CAIXA_FECHAR','ESTOQUE_AJUSTAR','PRODUTOS_GERENCIAR','FORNECEDORES_GERENCIAR','LOTES_REMOVER','FIADOS_LANCAR','FIADOS_RECEBER','VASILHAMES_MOVIMENTAR','DELIVERY_ACERTAR'] as const;
export const gestores = ['GERENTE','ADMINISTRADOR','PROPRIETARIO'];
export type AtorFuncionario = { id: string; funcionarioId: string };
export function validarHierarquia(cargo: string, alvo: string) {
  if (!gestores.includes(cargo) || (alvo === 'PROPRIETARIO' && cargo !== 'PROPRIETARIO') || (alvo === 'ADMINISTRADOR' && cargo === 'GERENTE'))
    throw new ForbiddenException('Você não pode administrar este cargo.');
}
export function validarPermissoes(valores: string[]) {
  if (valores.some(v => !PERMISSOES_FUNCIONARIO.some(p => p === v)))
    throw new BadRequestException('Permissão não reconhecida.');
  return [...new Set(valores)];
}
export function validarSenhaTemporaria(senha: string) {
  if (senha.length < 10 || Buffer.byteLength(senha, 'utf8') > 72 || !senha.trim())
    throw new BadRequestException('A senha temporária deve ter pelo menos 10 caracteres e até 72 bytes.');
}

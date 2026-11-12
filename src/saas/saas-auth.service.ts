import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { SaasCargo } from '@prisma/client';

export const SAAS_PERMISSIONS = ['EMPRESAS', 'PLANOS', 'MODULOS', 'FUNCIONARIOS'] as const;
export type SaasPermission = typeof SAAS_PERMISSIONS[number];

@Injectable()
export class SaasAuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private publicUser(user: { id: string; codigo: number; nome: string; email?: string | null; cargo: SaasCargo; permissoes: string[]; ativo: boolean }) {
    return { id: user.id, codigo: user.codigo, nome: user.nome, email: user.email, cargo: user.cargo, permissoes: user.permissoes, ativo: user.ativo };
  }

  async login(codigo: number, senha: string) {
    const user = await this.prisma.saasOperador.findUnique({ where: { codigo } });
    if (!user || !user.ativo || !await bcrypt.compare(senha, user.senha)) {
      throw new UnauthorizedException('Login ou senha incorretos.');
    }
    const sessaoId = randomUUID();
    await this.prisma.saasOperador.update({ where: { id: user.id }, data: { sessaoId } });
    return {
      access_token: await this.jwt.signAsync({ sub: user.id, tipo: 'SAAS_ADMIN', sessaoId }, { expiresIn: '8h' }),
      usuario: this.publicUser(user),
    };
  }

  async sair(id: string, sessaoId: string) {
    await this.prisma.saasOperador.updateMany({ where: { id, sessaoId }, data: { sessaoId: null } });
    return { encerrada: true };
  }

  async listar() {
    const users = await this.prisma.saasOperador.findMany({
      select: { id: true, codigo: true, nome: true, cargo: true, permissoes: true, ativo: true, email: true, criadoEm: true },
      orderBy: { codigo: 'asc' },
    });
    return users;
  }

  async criar(input: { codigo: number; nome: string; senha: string; cargo: SaasCargo; permissoes: string[] }) {

    if (input.permissoes.some(p => !SAAS_PERMISSIONS.includes(p as SaasPermission))) {
      throw new BadRequestException('Permissão inválida.');
    }
    if (input.cargo === SaasCargo.SUPER_ADMIN) throw new ForbiddenException('Outros superadministradores só podem ser provisionados localmente.');
    const duplicate = await this.prisma.saasOperador.findUnique({ where: { codigo: input.codigo } });
    if (duplicate) throw new ConflictException('Código de acesso já cadastrado.');
    const senha = await bcrypt.hash(input.senha, 12);
    const user = await this.prisma.saasOperador.create({
      data: { codigo: input.codigo, nome: input.nome.trim(), senha, cargo: input.cargo, permissoes: input.permissoes },
    });
    return this.publicUser(user);
  }

  async atualizarPerfil(id: string, input: { nome?: string; email?: string; senhaAtual?: string; novaSenha?: string }) {
    const existente = await this.prisma.saasOperador.findUnique({ where: { id } });
    if (!existente?.ativo) throw new UnauthorizedException('Sessão inválida.');
    if (input.novaSenha && (!input.senhaAtual || !await bcrypt.compare(input.senhaAtual, existente.senha))) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    if (!input.nome && input.email === undefined && !input.novaSenha) throw new BadRequestException('Nenhuma alteração informada.');
    const atualizado = await this.prisma.saasOperador.update({
      where: { id },
      data: {
        ...(input.nome !== undefined ? { nome: input.nome.trim() } : {}),
        ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
        ...(input.novaSenha ? { senha: await bcrypt.hash(input.novaSenha, 12), sessaoId: null } : {}),
      },
    });
    return this.publicUser(atualizado);
  }

  async atualizar(id: string, input: { codigo?: number; nome?: string; email?: string | null; senha?: string; senhaAtualAdmin?: string; permissoes?: string[]; ativo?: boolean }, operadorId: string) {
    const [existing, actor] = await Promise.all([
      this.prisma.saasOperador.findUnique({ where: { id } }),
      this.prisma.saasOperador.findUnique({ where: { id: operadorId } }),
    ]);
    if (!existing) throw new BadRequestException('Funcionário não encontrado.');
    if (!actor?.ativo) throw new UnauthorizedException('Sessão administrativa inválida.');
    if (input.permissoes?.some(p => !SAAS_PERMISSIONS.includes(p as SaasPermission))) {
      throw new BadRequestException('Permissão inválida.');
    }
    const nome = input.nome?.trim();
    if (input.nome !== undefined && (!nome || nome.length < 2)) {
      throw new BadRequestException('O nome precisa ter ao menos 2 caracteres.');
    }
    const email = input.email?.trim().toLowerCase();
    if (existing.cargo === SaasCargo.SUPER_ADMIN) {
      if (actor.cargo !== SaasCargo.SUPER_ADMIN) {
        throw new ForbiddenException('Apenas um superadministrador pode editar um superadministrador.');
      }
      // Preserve the two reserved identifiers and privileged, active accounts.
      if (existing.codigo !== 1 && existing.codigo !== 2) {
        throw new ForbiddenException('Este superadministrador exige atualização por provisionamento seguro.');
      }
      if (input.codigo !== undefined && input.codigo !== existing.codigo) {
        throw new BadRequestException('Os códigos principais 1 e 2 não podem ser alterados.');
      }
      if (input.ativo === false || input.permissoes !== undefined) {
        throw new ForbiddenException('Não é permitido desativar ou restringir os administradores principais.');
      }
      // Only the account holder can change their own password through Meu Perfil,
      // which verifies their current password and revokes the active session.
      if (input.senha !== undefined) {
        throw new ForbiddenException('A senha dos administradores principais deve ser alterada em Meu perfil.');
      }
      const user = await this.prisma.saasOperador.update({
        where: { id },
        data: {
          ...(nome !== undefined ? { nome } : {}),
          ...(input.email !== undefined ? { email: email || null } : {}),
        },
      });
      return this.publicUser(user);
    }
    const user = await this.prisma.saasOperador.update({
      where: { id },
      data: {
        ...(nome !== undefined ? { nome } : {}),
        ...(input.email !== undefined ? { email: email || null } : {}),
        ...(input.codigo !== undefined ? { codigo: input.codigo } : {}),
        ...(input.permissoes !== undefined ? { permissoes: input.permissoes } : {}),
        ...(input.ativo !== undefined ? { ativo: input.ativo, sessaoId: null } : {}),
        ...(input.senha ? { senha: await bcrypt.hash(input.senha, 12), sessaoId: null } : {}),
      },
    });
    return this.publicUser(user);
  }
}

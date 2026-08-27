import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CallNote,
  QaEvaluation,
  QaForm,
  QaQuestion,
  QaScore,
} from '../../database/entities';
import { QaEvaluationStatus, UserRole } from '../../common/enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { sanitizeText } from '../../common/utils/asterisk-sanitize';
import {
  CreateCallNoteDto,
  CreateEvaluationDto,
  CreateQaFormDto,
  SubmitScoresDto,
  UpdateQaFormDto,
} from './dto/qa.dto';

@Injectable()
export class QaService {
  private readonly logger = new Logger(QaService.name);

  constructor(
    @InjectRepository(QaForm) private readonly forms: Repository<QaForm>,
    @InjectRepository(QaQuestion) private readonly questions: Repository<QaQuestion>,
    @InjectRepository(QaEvaluation) private readonly evals: Repository<QaEvaluation>,
    @InjectRepository(QaScore) private readonly scores: Repository<QaScore>,
    @InjectRepository(CallNote) private readonly notes: Repository<CallNote>,
  ) {}

  private isStaff(user: AuthenticatedUser): boolean {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR;
  }

  /* ------------------------------- Forms ------------------------------- */

  async createForm(dto: CreateQaFormDto): Promise<QaForm> {
    const name = sanitizeText(dto.name, 120);
    if (await this.forms.findOne({ where: { name } })) {
      throw new ConflictException(`QA form "${name}" already exists`);
    }
    const form = this.forms.create({
      name,
      description: dto.description ? sanitizeText(dto.description, 300) : null,
      isActive: dto.isActive ?? true,
      questions: dto.questions.map((q, i) =>
        this.questions.create({
          section: q.section ? sanitizeText(q.section, 120) : null,
          text: sanitizeText(q.text, 400),
          maxScore: q.maxScore ?? 5,
          weight: q.weight ?? 1,
          sortOrder: q.sortOrder ?? i,
        }),
      ),
    });
    const saved = await this.forms.save(form);
    return this.getForm(saved.id);
  }

  listForms(activeOnly = false): Promise<QaForm[]> {
    return this.forms.find({
      where: activeOnly ? { isActive: true } : {},
      order: { name: 'ASC' },
    });
  }

  async getForm(id: string): Promise<QaForm> {
    const form = await this.forms.findOne({
      where: { id },
      relations: { questions: true },
    });
    if (!form) throw new NotFoundException('QA form not found');
    form.questions.sort((a, b) => a.sortOrder - b.sortOrder);
    return form;
  }

  async updateForm(id: string, dto: UpdateQaFormDto): Promise<QaForm> {
    const form = await this.getForm(id);
    if (dto.name !== undefined) form.name = sanitizeText(dto.name, 120);
    if (dto.description !== undefined) {
      form.description = dto.description ? sanitizeText(dto.description, 300) : null;
    }
    if (dto.isActive !== undefined) form.isActive = dto.isActive;
    if (dto.questions !== undefined) {
      await this.questions.delete({ formId: id });
      form.questions = dto.questions.map((q, i) =>
        this.questions.create({
          formId: id,
          section: q.section ? sanitizeText(q.section, 120) : null,
          text: sanitizeText(q.text, 400),
          maxScore: q.maxScore ?? 5,
          weight: q.weight ?? 1,
          sortOrder: q.sortOrder ?? i,
        }),
      );
    }
    await this.forms.save(form);
    return this.getForm(id);
  }

  async removeForm(id: string): Promise<void> {
    const res = await this.forms.delete(id);
    if (!res.affected) throw new NotFoundException('QA form not found');
  }

  /* ---------------------------- Evaluations ---------------------------- */

  async createEvaluation(
    dto: CreateEvaluationDto,
    assignedBy: AuthenticatedUser,
  ): Promise<QaEvaluation> {
    const form = await this.getForm(dto.formId);
    const maxScore = form.questions.reduce((s, q) => s + q.maxScore * q.weight, 0);

    const evalRow = this.evals.create({
      formId: form.id,
      uniqueid: sanitizeText(dto.uniqueid, 150),
      agentExtension: dto.agentExtension ?? null,
      agentId: dto.agentId ?? null,
      evaluatorId: dto.evaluatorId,
      assignedById: assignedBy.sub,
      status: QaEvaluationStatus.ASSIGNED,
      totalScore: 0,
      maxScore,
      scorePct: '0',
    });
    const saved = await this.evals.save(evalRow);
    this.logger.log(`QA evaluation ${saved.id} assigned to ${dto.evaluatorId}`);
    return saved;
  }

  async listEvaluations(
    user: AuthenticatedUser,
    filters: { status?: string; evaluatorId?: string; agentExtension?: string },
  ): Promise<QaEvaluation[]> {
    const qb = this.evals.createQueryBuilder('e').orderBy('e.createdAt', 'DESC');

    if (!this.isStaff(user)) {
      // Agents only see evaluations of themselves.
      qb.where('(e.agentId = :uid OR e.agentExtension = :ext)', {
        uid: user.sub,
        ext: user.extension ?? '',
      });
    } else {
      if (filters.evaluatorId) qb.andWhere('e.evaluatorId = :ev', { ev: filters.evaluatorId });
      if (filters.agentExtension) {
        qb.andWhere('e.agentExtension = :ax', { ax: filters.agentExtension });
      }
    }
    if (filters.status) qb.andWhere('e.status = :st', { st: filters.status });
    return qb.take(500).getMany();
  }

  async getEvaluation(
    id: string,
    user: AuthenticatedUser,
  ): Promise<QaEvaluation & { form: QaForm }> {
    const evalRow = await this.evals.findOne({
      where: { id },
      relations: { scores: true },
    });
    if (!evalRow) throw new NotFoundException('Evaluation not found');

    const isEvaluated =
      evalRow.agentId === user.sub ||
      (!!user.extension && evalRow.agentExtension === user.extension);
    if (!this.isStaff(user) && !isEvaluated) {
      throw new ForbiddenException('Not permitted to view this evaluation');
    }
    const form = await this.getForm(evalRow.formId);
    return Object.assign(evalRow, { form });
  }

  /** Assigned evaluator (or admin) records per-question scores. */
  async submitScores(
    id: string,
    user: AuthenticatedUser,
    dto: SubmitScoresDto,
  ): Promise<QaEvaluation> {
    const evalRow = await this.evals.findOne({ where: { id } });
    if (!evalRow) throw new NotFoundException('Evaluation not found');
    this.assertEvaluator(evalRow, user);
    if (evalRow.status === QaEvaluationStatus.COMPLETED) {
      throw new BadRequestException('Evaluation is already completed');
    }

    const form = await this.getForm(evalRow.formId);
    const qById = new Map(form.questions.map((q) => [q.id, q]));

    for (const item of dto.scores) {
      const q = qById.get(item.questionId);
      if (!q) throw new BadRequestException(`Unknown question ${item.questionId}`);
      if (item.score > q.maxScore) {
        throw new BadRequestException(
          `Score ${item.score} exceeds max ${q.maxScore} for a question`,
        );
      }
      const existing = await this.scores.findOne({
        where: { evaluationId: id, questionId: item.questionId },
      });
      if (existing) {
        existing.score = item.score;
        existing.comment = item.comment ?? null;
        await this.scores.save(existing);
      } else {
        await this.scores.save(
          this.scores.create({
            evaluationId: id,
            questionId: item.questionId,
            score: item.score,
            comment: item.comment ?? null,
          }),
        );
      }
    }

    await this.recompute(id, form);
    if (dto.summary !== undefined) {
      await this.evals.update(id, { summary: sanitizeText(dto.summary, 2000) });
    }
    if (evalRow.status === QaEvaluationStatus.ASSIGNED) {
      await this.evals.update(id, { status: QaEvaluationStatus.IN_PROGRESS });
    }
    return this.evals.findOne({ where: { id } }) as Promise<QaEvaluation>;
  }

  async complete(id: string, user: AuthenticatedUser): Promise<QaEvaluation> {
    const evalRow = await this.evals.findOne({ where: { id } });
    if (!evalRow) throw new NotFoundException('Evaluation not found');
    this.assertEvaluator(evalRow, user);
    await this.evals.update(id, {
      status: QaEvaluationStatus.COMPLETED,
      completedAt: new Date(),
    });
    this.logger.log(`QA evaluation ${id} completed`);
    return this.evals.findOne({ where: { id } }) as Promise<QaEvaluation>;
  }

  /** The evaluated agent may dispute a completed evaluation. */
  async dispute(id: string, user: AuthenticatedUser): Promise<QaEvaluation> {
    const evalRow = await this.evals.findOne({ where: { id } });
    if (!evalRow) throw new NotFoundException('Evaluation not found');
    const isEvaluated =
      evalRow.agentId === user.sub ||
      (!!user.extension && evalRow.agentExtension === user.extension);
    if (!isEvaluated) throw new ForbiddenException('Only the evaluated agent may dispute');
    if (evalRow.status !== QaEvaluationStatus.COMPLETED) {
      throw new BadRequestException('Only completed evaluations can be disputed');
    }
    await this.evals.update(id, { status: QaEvaluationStatus.DISPUTED });
    return this.evals.findOne({ where: { id } }) as Promise<QaEvaluation>;
  }

  private assertEvaluator(evalRow: QaEvaluation, user: AuthenticatedUser): void {
    if (user.role === UserRole.ADMIN) return;
    if (evalRow.evaluatorId !== user.sub) {
      throw new ForbiddenException('You are not the assigned evaluator');
    }
  }

  private async recompute(evaluationId: string, form: QaForm): Promise<void> {
    const rows = await this.scores.find({ where: { evaluationId } });
    const byQ = new Map(rows.map((r) => [r.questionId, r.score]));
    let total = 0;
    let max = 0;
    for (const q of form.questions) {
      max += q.maxScore * q.weight;
      total += (byQ.get(q.id) ?? 0) * q.weight;
    }
    const pct = max > 0 ? (total / max) * 100 : 0;
    await this.evals.update(evaluationId, {
      totalScore: total,
      maxScore: max,
      scorePct: pct.toFixed(2),
    });
  }

  /* ----------------------------- Call notes ---------------------------- */

  async addNote(
    uniqueid: string,
    user: AuthenticatedUser,
    dto: CreateCallNoteDto,
  ): Promise<CallNote> {
    return this.notes.save(
      this.notes.create({
        uniqueid: sanitizeText(uniqueid, 150),
        authorId: user.sub,
        note: dto.note,
        tags: (dto.tags ?? []).map((t) => sanitizeText(t, 40)),
      }),
    );
  }

  listNotes(uniqueid: string): Promise<CallNote[]> {
    return this.notes.find({
      where: { uniqueid },
      order: { createdAt: 'DESC' },
    });
  }

  async removeNote(id: string, user: AuthenticatedUser): Promise<void> {
    const note = await this.notes.findOne({ where: { id } });
    if (!note) throw new NotFoundException('Note not found');
    if (note.authorId !== user.sub && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete your own notes');
    }
    await this.notes.delete(id);
  }
}

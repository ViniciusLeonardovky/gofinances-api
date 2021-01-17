import { getRepository, In, Repository } from 'typeorm';

import { Category } from '@modules/transactions/infra/typeorm/entities/Category';

import { ICategoryTransactionsRepository } from '@modules/transactions/repositories/ICategoryTransactionsRepository';
import { ICreateCategoryDTO } from '@modules/transactions/dtos/ICreateCategoryDTO';

export class CategoriesRepository implements ICategoryTransactionsRepository {
  private ormRepository: Repository<Category>;

  constructor() {
    this.ormRepository = getRepository(Category);
  }

  public async findCategory(title: string): Promise<Category | undefined> {
    const category = await this.ormRepository.findOne({ where: { title } });

    return category || undefined;
  }

  public async findCategories(categories: string[]): Promise<Category[]> {
    const existentCategories = await this.ormRepository.find({
      where: {
        title: In(categories),
      },
    });

    return existentCategories;
  }

  public async create({ title }: ICreateCategoryDTO): Promise<Category> {
    const category = this.ormRepository.create({ title });

    await this.ormRepository.save(category);

    return category;
  }
}

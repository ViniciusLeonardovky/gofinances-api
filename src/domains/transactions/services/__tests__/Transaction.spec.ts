import request from 'supertest';
import path from 'path';
import { Connection, getRepository, getConnection } from 'typeorm';
import createConnection from '@shared/infra/typeorm/index';
import { v4 } from 'uuid';

import { Transaction } from '@domains/transactions/infra/typeorm/entities/Transaction';
import { Category } from '@domains/transactions/infra/typeorm/entities/Category';

import { app } from '@shared/infra/http/app';

let connection: Connection;

describe('Transaction', () => {
  beforeAll(async () => {
    connection = await createConnection('test-connection');

    await connection.query('DROP TABLE IF EXISTS migrations');
    await connection.query('DROP TABLE IF EXISTS transactions');
    await connection.query('DROP TABLE IF EXISTS categories');
    await connection.query('DROP TABLE IF EXISTS users');

    await connection.runMigrations();
  });

  beforeEach(async () => {
    await connection.query('DELETE FROM transactions');
    await connection.query('DELETE FROM categories');
    await connection.query('DELETE FROM users');
  });

  afterAll(async () => {
    const mainConnection = getConnection();

    await connection.close();
    await mainConnection.close();
  });

  it('should be able to list transactions', async () => {
    await request(app).post('/users').send({
      name: 'Nome maneiro',
      email: 'teste@teste.com',
      password: '123456',
    });

    const authUser = await request(app).post('/sessions').send({
      email: 'teste@teste.com',
      password: '123456',
    });

    await request(app)
      .post('/transactions')
      .send({
        title: 'March Salary',
        type: 'income',
        value: 4000,
        category: 'Salary',
      })
      .set('Authorization', `bearer ${authUser.body.token}`);

    await request(app)
      .post('/transactions')
      .send({
        title: 'April Salary',
        type: 'income',
        value: 4000,
        category: 'Salary',
      })
      .set('Authorization', `bearer ${authUser.body.token}`);

    await request(app)
      .post('/transactions')
      .send({
        title: 'Macbook',
        type: 'outcome',
        value: 6000,
        category: 'Eletronics',
      })
      .set('Authorization', `bearer ${authUser.body.token}`);

    const response = await request(app)
      .get('/transactions')
      .set('Authorization', `bearer ${authUser.body.token}`);

    expect(response.body.transactions).toHaveLength(3);
    expect(response.body.balance).toMatchObject({
      income: 8000,
      outcome: 6000,
      total: 2000,
    });
  });

  it('should be able to create new transaction', async () => {
    const transactionsRepository = getRepository(Transaction);

    await request(app).post('/users').send({
      name: 'Nome maneiro',
      email: 'teste@teste.com',
      password: '123456',
    });

    const authUser = await request(app).post('/sessions').send({
      email: 'teste@teste.com',
      password: '123456',
    });

    const response = await request(app)
      .post('/transactions')
      .send({
        title: 'March Salary',
        type: 'income',
        value: 4000,
        category: 'Salary',
      })
      .set('Authorization', `bearer ${authUser.body.token}`);

    const transaction = await transactionsRepository.findOne({
      where: {
        title: 'March Salary',
        user_id: authUser.body.user.id,
      },
    });

    console.log('-> transaction: ', authUser.body.user.id);

    expect(transaction).toBeTruthy();

    expect(response.body).toMatchObject(
      expect.objectContaining({
        id: expect.any(String),
      }),
    );
  });

  it('should create tags when inserting new transactions', async () => {
    const transactionsRepository = getRepository(Transaction);
    const categoriesRepository = getRepository(Category);

    await request(app).post('/users').send({
      name: 'Nome maneiro',
      email: 'teste@teste.com',
      password: '123456',
    });

    const authUser = await request(app).post('/sessions').send({
      email: 'teste@teste.com',
      password: '123456',
    });

    const response = await request(app)
      .post('/transactions')
      .send({
        title: 'March Salary',
        type: 'income',
        value: 4000,
        category: 'Salary',
      })
      .set('Authorization', `bearer ${authUser.body.token}`);

    const category = await categoriesRepository.findOne({
      where: {
        title: 'Salary',
      },
    });

    expect(category).toBeTruthy();

    const transaction = await transactionsRepository.findOne({
      where: {
        title: 'March Salary',
        category_id: category?.id,
      },
    });

    expect(transaction).toBeTruthy();

    expect(response.body).toMatchObject(
      expect.objectContaining({
        id: expect.any(String),
      }),
    );
  });

  it('should not create tags when they already exists', async () => {
    const transactionsRepository = getRepository(Transaction);
    const categoriesRepository = getRepository(Category);

    const { identifiers } = await categoriesRepository.insert({
      title: 'Salary',
    });

    const insertedCategoryId = identifiers[0].id;

    await request(app).post('/users').send({
      name: 'Nome maneiro',
      email: 'teste@teste.com',
      password: '123456',
    });

    const authUser = await request(app).post('/sessions').send({
      email: 'teste@teste.com',
      password: '123456',
    });

    await request(app)
      .post('/transactions')
      .send({
        title: 'March Salary',
        type: 'income',
        value: 4000,
        category: 'Salary',
      })
      .set('Authorization', `bearer ${authUser.body.token}`);

    const transaction = await transactionsRepository.findOne({
      where: {
        title: 'March Salary',
        category_id: insertedCategoryId,
      },
    });

    const categoriesCount = await categoriesRepository.find();

    expect(categoriesCount).toHaveLength(1);
    expect(transaction).toBeTruthy();
  });

  it('should not be able to create outcome transaction without a valid balance', async () => {
    await request(app).post('/users').send({
      name: 'Nome maneiro',
      email: 'teste@teste.com',
      password: '123456',
    });

    const authUser = await request(app).post('/sessions').send({
      email: 'teste@teste.com',
      password: '123456',
    });

    await request(app)
      .post('/transactions')
      .send({
        title: 'March Salary',
        type: 'income',
        value: 4000,
        category: 'Salary',
      })
      .set('Authorization', `bearer ${authUser.body.token}`);

    const response = await request(app)
      .post('/transactions')
      .send({
        title: 'iPhone',
        type: 'outcome',
        value: 4500,
        category: 'Eletronics',
      })
      .set('Authorization', `bearer ${authUser.body.token}`);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject(
      expect.objectContaining({
        status: 'error',
        message: expect.any(String),
      }),
    );
  });

  it('should be able to delete a transaction', async () => {
    const transactionsRepository = getRepository(Transaction);

    await request(app).post('/users').send({
      name: 'Nome maneiro',
      email: 'teste@teste.com',
      password: '123456',
    });

    const authUser = await request(app).post('/sessions').send({
      email: 'teste@teste.com',
      password: '123456',
    });

    const response = await request(app)
      .post('/transactions')
      .send({
        title: 'March Salary',
        type: 'income',
        value: 4000,
        category: 'Salary',
      })
      .set('Authorization', `bearer ${authUser.body.token}`);

    await request(app)
      .delete(`/transactions/${response.body.id}`)
      .set('Authorization', `bearer ${authUser.body.token}`);

    const transaction = await transactionsRepository.findOne(response.body.id);

    expect(transaction).toBeFalsy();
  });

  it('should not be able to delete a transaction if not exists', async () => {
    const transactionsRepository = getRepository(Transaction);

    await request(app).post('/users').send({
      name: 'Nome maneiro',
      email: 'teste@teste.com',
      password: '123456',
    });

    const authUser = await request(app).post('/sessions').send({
      email: 'teste@teste.com',
      password: '123456',
    });

    const fakeId = v4();

    const response = await request(app)
      .delete(`/transactions/${fakeId}`)
      .set('Authorization', `bearer ${authUser.body.token}`);

    const transaction = await transactionsRepository.findOne(fakeId);

    expect(response.body.message).toBe('transaction not found');
    expect(transaction).toBeFalsy();
  });

  it('should be able to import transactions', async () => {
    const transactionsRepository = getRepository(Transaction);
    const categoriesRepository = getRepository(Category);

    const importCSV = path.resolve(__dirname, 'import_template.csv');

    await request(app).post('/users').send({
      name: 'Nome maneiro',
      email: 'teste@teste.com',
      password: '123456',
    });

    const authUser = await request(app).post('/sessions').send({
      email: 'teste@teste.com',
      password: '123456',
    });

    await request(app)
      .post('/transactions/import')
      .attach('file', importCSV)
      .set('Authorization', `bearer ${authUser.body.token}`);

    const transactions = await transactionsRepository.find();
    const categories = await categoriesRepository.find();

    expect(categories).toHaveLength(2);
    expect(categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Others',
        }),
        expect.objectContaining({
          title: 'Food',
        }),
      ]),
    );

    expect(transactions).toHaveLength(3);
    expect(transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Loan',
          type: 'income',
        }),
        expect.objectContaining({
          title: 'Website Hosting',
          type: 'outcome',
        }),
        expect.objectContaining({
          title: 'Ice cream',
          type: 'outcome',
        }),
      ]),
    );
  });

  it('should not create categories that already exists', async () => {
    const categoriesRepository = getRepository(Category);

    const importCSV = path.resolve(__dirname, 'import_template2.csv');
    const importCSV2 = path.resolve(__dirname, 'import_template2.csv');

    await request(app).post('/users').send({
      name: 'Nome maneiro',
      email: 'teste@teste.com',
      password: '123456',
    });

    const authUser = await request(app).post('/sessions').send({
      email: 'teste@teste.com',
      password: '123456',
    });

    await request(app)
      .post('/transactions/import')
      .attach('file', importCSV)
      .set('Authorization', `bearer ${authUser.body.token}`);
    await request(app)
      .post('/transactions/import')
      .attach('file', importCSV2)
      .set('Authorization', `bearer ${authUser.body.token}`);

    const categories = await categoriesRepository.find();

    expect(categories).toHaveLength(2);
  });
});
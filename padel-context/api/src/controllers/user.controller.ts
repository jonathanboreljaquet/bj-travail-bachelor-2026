import { Request, Response } from 'express';
import prisma from '../db';

export const getAllUsers = async (req: Request, res: Response): Promise<any> => {
    const users = await prisma.user.findMany();
    res.status(200).json(users);
};

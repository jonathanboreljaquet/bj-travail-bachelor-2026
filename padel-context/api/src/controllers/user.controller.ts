import { Request, Response } from 'express';
import prisma from '../db';

export const getAllUsers = async (req: Request, res: Response): Promise<any> => {
    const users = await prisma.user.findMany({
        select: {
            firstname: true,
            lastname: true,
            email: true,
            level: true,
        },
    });
    res.status(200).json(users);
};

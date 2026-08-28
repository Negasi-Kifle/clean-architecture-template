import { NotFoundError, type EmployeeEntity, type IEmployeeRepository } from "../../../domain";

export class GetEmployeeUseCase {
    constructor(private readonly employeeRepository: IEmployeeRepository) {}

    async execute(employeeId: string): Promise<EmployeeEntity> {
        const employee = await this.employeeRepository.findDetailById(employeeId);
        if (!employee) throw new NotFoundError("Employee", employeeId);
        return employee;
    }
}

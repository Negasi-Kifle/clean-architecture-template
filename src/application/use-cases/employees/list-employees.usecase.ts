import type {
    EmployeeEntity,
    EmployeeFilters,
    EmployeeSortField,
    IEmployeeRepository,
    Paginated,
    QueryOptions,
} from "../../../domain";
import { paginate } from "../../paginate";

export class ListEmployeesUseCase {
    constructor(private readonly employeeRepository: IEmployeeRepository) {}

    async execute(
        options: QueryOptions<EmployeeFilters, EmployeeSortField>,
    ): Promise<Paginated<EmployeeEntity>> {
        return paginate(this.employeeRepository, options);
    }
}

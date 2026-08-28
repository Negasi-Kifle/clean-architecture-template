import type {
    Paginated,
    QueryOptions,
    UserEntity,
    UserFilters,
    UserSortField,
    IUserRepository,
} from "../../../domain";
import { paginate } from "../../paginate";

export class ListUsersUseCase {
    constructor(private readonly userRepository: IUserRepository) {}

    async execute(
        options: QueryOptions<UserFilters, UserSortField>,
    ): Promise<Paginated<UserEntity>> {
        return paginate(this.userRepository, options);
    }
}
